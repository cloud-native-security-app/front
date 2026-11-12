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
 * - 403: stop, drop the data and let the session re-read the role;
 * - 503 (role not verifiable) and network errors: keep retrying.
 * A successful reconnect always yields a fresh snapshot (the Gateway sends
 * one first), so no event is replayed or merged across a gap.
 */

import { useEffect, useReducer, useRef, useState } from "react";

import {
  getAdminMetrics,
  subscribeToAdminEvents,
  type AdminEventsSubscription,
  type AdminSnapshot,
} from "../../api";
import { adminReducer, type AdminAction } from "./adminReducer";
import { BUCKET_SECONDS } from "./series";

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

export interface AdminFeedOptions {
  /** Clock in epoch ms; injected by tests (default `Date.now`). */
  now?: () => number;
}

/** The tick fires just after the minute changes, never just before. */
const TICK_MARGIN_MS = 100;

export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 30_000;

/**
 * `onForbidden` runs once per 403 (the feed stops after it, so there is no
 * loop); the caller uses it to refresh the session role.
 */
export function useAdminFeed(
  onForbidden?: () => void,
  options: AdminFeedOptions = {},
): AdminFeed {
  const [snapshot, dispatch] = useReducer(adminReducer, undefined);
  const [status, setStatus] = useState<AdminFeedStatus>("connecting");
  const forbiddenRef = useRef(onForbidden);
  useEffect(() => {
    forbiddenRef.current = onForbidden;
  }, [onForbidden]);

  const nowRef = useRef(options.now ?? Date.now);
  useEffect(() => {
    nowRef.current = options.now ?? Date.now;
  }, [options.now]);

  // One-minute tick: rotates the charts' window (the reducer ignores it
  // without a series, and a late tick in a throttled tab catches up).
  useEffect(() => {
    const minuteMs = BUCKET_SECONDS * 1000;
    let timer: ReturnType<typeof setTimeout>;
    function schedule(): void {
      timer = setTimeout(
        () => {
          dispatch({ type: "tick", now: nowRef.current() });
          schedule();
        },
        minuteMs - (nowRef.current() % minuteMs) + TICK_MARGIN_MS,
      );
    }
    schedule();
    return () => {
      clearTimeout(timer);
    };
  }, []);

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
            forbiddenRef.current?.();
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
