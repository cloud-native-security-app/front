/**
 * Data hook of the admin panel (feature `admin-panel`, AP-03). Runs with a
 * fake `EventSource` and a fake `fetch` (the two browser boundaries) and fake
 * timers: no real waits.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureGatewayBaseUrl } from "../../../src/api";
import { useAdminFeed } from "../../../src/features/admin";
import {
  makeDelta,
  makeEvent,
  makeFinding,
  makeKpis,
  makeSnapshot,
} from "./fixtures";

type Listener = (event: MessageEvent<string>) => void;

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  readonly withCredentials: boolean;
  closed = false;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data?: unknown): void {
    const event = new MessageEvent(type, {
      data: data === undefined ? undefined : JSON.stringify(data),
    });
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event as MessageEvent<string>);
    }
  }
}

const fetchMock = vi.fn<(url: string) => Promise<Response>>();

function respond(status: number, body?: unknown): void {
  fetchMock.mockResolvedValueOnce(
    new Response(body === undefined ? "x" : JSON.stringify(body), { status }),
  );
}

function latestSource(): FakeEventSource {
  const source = FakeEventSource.instances.at(-1);
  if (!source) {
    throw new Error("no EventSource opened");
  }
  return source;
}

async function flush(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useAdminFeed", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    configureGatewayBaseUrl("http://gateway.test");
    FakeEventSource.instances = [];
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    configureGatewayBaseUrl(undefined);
  });

  it("loads_the_snapshot_then_opens_the_stream_with_credentials", async () => {
    respond(200, makeSnapshot({ seq: 3 }));
    const { result } = renderHook(() => useAdminFeed());
    expect(result.current.status).toBe("connecting");

    await flush();

    expect(fetchMock.mock.calls[0][0]).toContain("/api/admin/metrics");
    expect(result.current.snapshot?.seq).toBe(3);
    const source = latestSource();
    expect(source.url).toContain("/api/admin/events");
    expect(source.withCredentials).toBe(true);

    act(() => {
      source.emit("snapshot", makeSnapshot({ seq: 4 }));
    });
    expect(result.current.status).toBe("live");
    expect(result.current.snapshot?.seq).toBe(4);
  });

  it("applies_deltas_and_ignores_garbage_messages", async () => {
    respond(200, makeSnapshot({ seq: 1 }));
    const { result } = renderHook(() => useAdminFeed());
    await flush();
    const source = latestSource();

    act(() => {
      source.emit("snapshot", makeSnapshot({ seq: 1 }));
      source.emit("delta", { nonsense: true });
      source.emit(
        "delta",
        makeDelta({
          seq: 2,
          event: makeEvent("e1"),
          kpis: makeKpis({ completed_last_window: 1 }),
          critical_finding: makeFinding("f1"),
        }),
      );
    });

    expect(result.current.snapshot?.kpis.completed_last_window).toBe(1);
    expect(result.current.snapshot?.critical_findings[0].event_id).toBe("f1");
    expect(result.current.snapshot?.recent_events).toHaveLength(1);
  });

  it("on_closed_it_closes_the_stream_and_reconnects_with_backoff_and_a_fresh_snapshot", async () => {
    respond(200, makeSnapshot({ seq: 1 }));
    const { result } = renderHook(() => useAdminFeed());
    await flush();
    const first = latestSource();
    act(() => {
      first.emit("snapshot", makeSnapshot({ seq: 1 }));
    });

    respond(200, makeSnapshot({ seq: 10 }));
    act(() => {
      first.emit("closed", { reason: "role_revalidation_failed" });
    });

    expect(first.closed).toBe(true);
    expect(result.current.status).toBe("reconnecting");
    expect(FakeEventSource.instances).toHaveLength(1);

    await advance(1000);

    expect(FakeEventSource.instances).toHaveLength(2);
    expect(result.current.snapshot?.seq).toBe(10);
  });

  it("backs_off_exponentially_up_to_30_seconds_and_resets_after_a_snapshot", async () => {
    fetchMock.mockImplementation(() =>
      Promise.reject(new TypeError("network down")),
    );
    const { result } = renderHook(() => useAdminFeed());
    await flush();
    expect(result.current.status).toBe("reconnecting");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const expectedDelays = [1000, 2000, 4000, 8000, 16000, 30000, 30000];
    let calls = 1;
    for (const delay of expectedDelays) {
      await advance(delay - 1);
      expect(fetchMock).toHaveBeenCalledTimes(calls);
      await advance(1);
      calls += 1;
      expect(fetchMock).toHaveBeenCalledTimes(calls);
    }

    fetchMock.mockReset();
    respond(200, makeSnapshot());
    await advance(30000);
    act(() => {
      latestSource().emit("snapshot", makeSnapshot());
    });
    expect(result.current.status).toBe("live");

    fetchMock.mockImplementation(() =>
      Promise.reject(new TypeError("network down")),
    );
    act(() => {
      latestSource().emit("closed", { reason: "role_revalidation_failed" });
    });
    await advance(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a_stream_error_closes_the_source_and_reconnects", async () => {
    respond(200, makeSnapshot());
    const { result } = renderHook(() => useAdminFeed());
    await flush();
    const source = latestSource();

    respond(200, makeSnapshot({ seq: 5 }));
    act(() => {
      source.emit("error");
    });
    expect(source.closed).toBe(true);
    expect(result.current.status).toBe("reconnecting");

    await advance(1000);
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("403_means_forbidden_drops_the_data_and_never_retries", async () => {
    respond(200, makeSnapshot({ seq: 1 }));
    const { result } = renderHook(() => useAdminFeed());
    await flush();
    const source = latestSource();

    respond(403);
    act(() => {
      source.emit("closed", { reason: "role_revalidation_failed" });
    });
    await advance(1000);

    expect(result.current.status).toBe("forbidden");
    expect(result.current.snapshot).toBeUndefined();
    await advance(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("503_is_unavailable_and_keeps_retrying_with_backoff", async () => {
    respond(503);
    const { result } = renderHook(() => useAdminFeed());
    await flush();
    expect(result.current.status).toBe("unavailable");

    respond(503);
    await advance(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("unavailable");

    respond(200, makeSnapshot());
    await advance(2000);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it("401_stops_without_retrying_the_session_flow_takes_over", async () => {
    respond(401);
    const { result } = renderHook(() => useAdminFeed());
    await flush();

    expect(result.current.status).toBe("session_ended");
    await advance(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("unmounting_closes_the_stream_and_cancels_pending_retries", async () => {
    respond(200, makeSnapshot());
    const { unmount } = renderHook(() => useAdminFeed());
    await flush();
    const source = latestSource();

    unmount();
    expect(source.closed).toBe(true);

    await advance(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
