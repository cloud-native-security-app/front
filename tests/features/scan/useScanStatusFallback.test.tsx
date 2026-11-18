/**
 * Polling fallback of the scan page (feature `scan-live-status`, SC-03):
 * when the SSE stream is down (or silent for too long) the status of the
 * tracked scan is read from `getScanHistory`. `getScanHistory` is stubbed
 * here (and only here) because the behaviour under test is timing, which
 * needs fake timers that do not mix with a real HTTP round trip.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConnectionStatus, ScanStatus } from "../../../src/api";
import { useScanStatusFallback } from "../../../src/features/scan";

const history = vi.hoisted(() => ({ getScanHistory: vi.fn() }));

vi.mock("../../../src/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/api")>();
  return { ...actual, getScanHistory: history.getScanHistory };
});

function historyWith(scanId: string, status: ScanStatus) {
  history.getScanHistory.mockResolvedValue({
    ok: true,
    value: [{ scanId, status }],
  });
}

interface Props {
  scanId: string | undefined;
  status: ScanStatus;
  connectionStatus: ConnectionStatus;
  eventReceived: boolean;
}

function setup(initial: Props) {
  const applyStatus = vi.fn();
  const hook = renderHook(
    (props: Props) => useScanStatusFallback({ ...props, applyStatus }),
    { initialProps: initial },
  );
  return { applyStatus, ...hook };
}

const running: Props = {
  scanId: "s1",
  status: "EN_PROGRESO",
  connectionStatus: "open",
  eventReceived: true,
};

describe("useScanStatusFallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    history.getScanHistory.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does_not_poll_while_the_stream_is_open_and_delivering_events", async () => {
    historyWith("s1", "COMPLETADO");
    setup(running);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(history.getScanHistory).not.toHaveBeenCalled();
  });

  it("polls_every_5s_when_reconnecting_and_applies_a_terminal_status", async () => {
    historyWith("s1", "EN_PROGRESO");
    const { applyStatus, rerender } = setup({
      ...running,
      connectionStatus: "reconnecting",
    });
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(history.getScanHistory).toHaveBeenCalledTimes(1);
    expect(applyStatus).not.toHaveBeenCalled();

    historyWith("s1", "COMPLETADO");
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(applyStatus).toHaveBeenCalledWith("COMPLETADO");

    rerender({
      ...running,
      status: "COMPLETADO",
      connectionStatus: "reconnecting",
    });
    history.getScanHistory.mockClear();
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(history.getScanHistory).not.toHaveBeenCalled();
  });

  it("polls_when_the_connection_is_closed_and_applies_cancelled_or_failed", async () => {
    historyWith("s1", "CANCELADO");
    const { applyStatus } = setup({ ...running, connectionStatus: "closed" });
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(applyStatus).toHaveBeenCalledWith("CANCELADO");
  });

  it("starts_polling_after_20s_without_any_event", async () => {
    historyWith("s1", "FALLIDO");
    const { applyStatus } = setup({
      scanId: "s1",
      status: "PENDIENTE",
      connectionStatus: "open",
      eventReceived: false,
    });
    await act(() => vi.advanceTimersByTimeAsync(19_000));
    expect(history.getScanHistory).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(applyStatus).toHaveBeenCalledWith("FALLIDO");
  });

  it("stops_polling_on_unmount", async () => {
    historyWith("s1", "EN_PROGRESO");
    const { unmount } = setup({ ...running, connectionStatus: "reconnecting" });
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    unmount();
    history.getScanHistory.mockClear();
    await act(() => vi.advanceTimersByTimeAsync(20_000));
    expect(history.getScanHistory).not.toHaveBeenCalled();
  });

  it("ignores_history_failures_and_unknown_scans", async () => {
    history.getScanHistory.mockResolvedValue({
      ok: false,
      error: { kind: "network" },
    });
    const { applyStatus } = setup({ ...running, connectionStatus: "closed" });
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    history.getScanHistory.mockResolvedValue({ ok: true, value: [] });
    await act(() => vi.advanceTimersByTimeAsync(5_000));
    expect(applyStatus).not.toHaveBeenCalled();
  });
});
