/**
 * Data hook of the admin panel (feature `admin-panel`): initial
 * `GET /api/admin/metrics`, then the SSE stream, reduced into one snapshot
 * (`adminReducer`).
 *
 * Failure policy. `EventSource` hides the HTTP status, so every stream error
 * and every `closed` event goes through the same path: close the stream, wait
 * (backoff 1 s doubling to 30 s, reset when a stream `snapshot` arrives) and
 * start over with `getAdminMetrics()`, whose status decides:
 * - 401: stop (the session flow in `src/auth` takes over);
 * - 403: stop and drop the data (no longer an admin);
 * - 503 (role not verifiable) and network errors: keep retrying.
 * A successful reconnect always yields a fresh snapshot (the Gateway sends
 * one first), so no event is replayed or merged across a gap.
 */

import { useEffect, useReducer, useState } from "react";

import {
  getAdminMetrics,
  subscribeToAdminEvents,
  type AdminEventsSubscription,
  type AdminSnapshot,
} from "../../api";
import { adminReducer, type AdminAction } from "./adminReducer";

export type AdminFeedStatus =
  | "connecting"
  | "live"
  | "reconnecting"
  | "unavailable"
  | "forbidden"
  | "session_ended";

export interface AdminFeed {
  status: AdminFeedStatus;
  /** Last known state; `undefined` before the first snapshot and after a 403. */
  snapshot: AdminSnapshot | undefined;
}

export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 30_000;

export function useAdminFeed(): AdminFeed {
  const [snapshot, dispatch] = useReducer(adminReducer, undefined);
  const [status, setStatus] = useState<AdminFeedStatus>("connecting");

  useEffect(() => {
    let cancelled = false;
    let subscription: AdminEventsSubscription | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    function scheduleReconnect(next: AdminFeedStatus): void {
      subscription?.close();
      subscription = undefined;
      setStatus(next);
      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** failures,
        RECONNECT_MAX_MS,
      );
      failures += 1;
      timer = setTimeout(() => void connect(), delay);
    }

    function apply(action: AdminAction): void {
      if (!cancelled) {
        dispatch(action);
      }
    }

    async function connect(): Promise<void> {
      const result = await getAdminMetrics();
      if (cancelled) {
        return;
      }
      if (!result.ok) {
        switch (result.error.kind) {
          case "unauthorized":
            setStatus("session_ended");
            return;
          case "forbidden":
            // Leave no admin data on screen once the role is gone.
            dispatch({ type: "reset" });
            setStatus("forbidden");
            return;
          case "unavailable":
            scheduleReconnect("unavailable");
            return;
          default:
            scheduleReconnect("reconnecting");
            return;
        }
      }
      dispatch({ type: "snapshot", snapshot: result.value });
      subscription = subscribeToAdminEvents({
        onSnapshot: (fresh) => {
          failures = 0;
          apply({ type: "snapshot", snapshot: fresh });
          setStatus("live");
        },
        onDelta: (delta) => {
          apply({ type: "delta", delta });
        },
        onClosed: () => {
          scheduleReconnect("reconnecting");
        },
        onError: () => {
          scheduleReconnect("reconnecting");
        },
      });
    }

    void connect();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription?.close();
    };
  }, []);

  return { status, snapshot };
}
