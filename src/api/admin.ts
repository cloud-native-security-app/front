/**
 * Admin real-time feed (feature `admin-panel`): the JSON snapshot
 * (`GET /api/admin/metrics`) and the SSE stream (`GET /api/admin/events`),
 * both behind session + admin role on the Gateway.
 *
 * Status codes (same for both routes): 401 no session, 403 not (or no longer)
 * an admin, 503 the role cannot be verified. `EventSource` never exposes the
 * HTTP status, so the stream reports only "something went wrong"
 * (`onError`); callers learn the cause by calling `getAdminMetrics()`, which
 * shares the Gateway's guard.
 */

import {
  isAdminDelta,
  isAdminSnapshot,
  isAdminStreamClosed,
} from "./adminGuards";
import { gatewayBaseUrl } from "./config";
import { parseJson, performRequest } from "./httpClient";
import type {
  AdminDelta,
  AdminSnapshot,
  AdminStreamClosed,
  ApiResult,
} from "./types";
import { notifyUnauthorized } from "./unauthorized";

/**
 * Unlike `mapCommonErrorStatus`, a 403 here does NOT notify "unauthorized":
 * the session is still valid, only the admin role is gone, so the user must
 * keep the session and just leave the panel.
 */
export async function getAdminMetrics(): Promise<ApiResult<AdminSnapshot>> {
  const result = await performRequest("/api/admin/metrics");
  if ("networkError" in result) {
    return { ok: false, error: { kind: "network" } };
  }
  switch (result.status) {
    case 200: {
      const parsed = parseJson(result.bodyText);
      if (!parsed.ok || !isAdminSnapshot(parsed.value)) {
        return { ok: false, error: { kind: "unexpected", status: 200 } };
      }
      return { ok: true, value: parsed.value };
    }
    case 401:
      notifyUnauthorized();
      return { ok: false, error: { kind: "unauthorized" } };
    case 403:
      return { ok: false, error: { kind: "forbidden" } };
    case 502:
    case 503:
    case 504:
      return { ok: false, error: { kind: "unavailable" } };
    default:
      return {
        ok: false,
        error: { kind: "unexpected", status: result.status },
      };
  }
}

export interface AdminEventsHandlers {
  onSnapshot: (snapshot: AdminSnapshot) => void;
  onDelta: (delta: AdminDelta) => void;
  /** The Gateway ended the stream on purpose (failed role re-check). */
  onClosed: (closed: AdminStreamClosed) => void;
  /** Connection failed or dropped (status unknown, see the module comment). */
  onError: () => void;
}

export interface AdminEventsSubscription {
  close(): void;
}

function parseData(event: Event): unknown {
  try {
    return JSON.parse((event as MessageEvent<string>).data) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Opens the admin stream with the session cookie (`withCredentials`).
 * Messages that do not match their type are ignored. Unlike the per-scan
 * stream, it never lets `EventSource` retry by itself: on any error the
 * source is closed and `onError` fires once, so the caller owns the
 * reconnection (backoff and a fresh snapshot).
 */
export function subscribeToAdminEvents(
  handlers: AdminEventsHandlers,
): AdminEventsSubscription {
  const source = new EventSource(`${gatewayBaseUrl()}/api/admin/events`, {
    withCredentials: true,
  });
  let finished = false;

  function finish(): boolean {
    if (finished) {
      return false;
    }
    finished = true;
    source.close();
    return true;
  }

  source.addEventListener("snapshot", (event) => {
    const data = parseData(event);
    if (!finished && isAdminSnapshot(data)) {
      handlers.onSnapshot(data);
    }
  });
  source.addEventListener("delta", (event) => {
    const data = parseData(event);
    if (!finished && isAdminDelta(data)) {
      handlers.onDelta(data);
    }
  });
  source.addEventListener("closed", (event) => {
    const data = parseData(event);
    if (finish()) {
      handlers.onClosed(
        isAdminStreamClosed(data) ? data : { reason: "unknown" },
      );
    }
  });
  source.addEventListener("error", () => {
    if (finish()) {
      handlers.onError();
    }
  });

  return {
    close: () => {
      finished = true;
      source.close();
    },
  };
}
