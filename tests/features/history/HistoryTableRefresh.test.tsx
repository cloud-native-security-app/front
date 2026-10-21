/**
 * Immediate history refresh (feature `sectioned-navigation`, SNV-03): when
 * the live scan tracked by `ScanActivityProvider` reaches a terminal state,
 * `HistoryTable` refetches right away instead of waiting for the 7 s poll.
 * `subscribeToScanEvents` is stubbed for the same jsdom/EventSource reason
 * documented in `tests/features/scan/ScanForm.test.tsx`.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cancelScan, submitScan } from "../../../src/api";
import type { ScanEventsSubscription } from "../../../src/api";
import { HistoryTable } from "../../../src/features/history";
import {
  ScanActivityProvider,
  useScanActivity,
} from "../../../src/features/scan";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../../api/testHelpers";

const subscription = vi.hoisted(() => ({
  onEvent: undefined as ((event: unknown) => void) | undefined,
}));

vi.mock("../../../src/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/api")>();
  return {
    ...actual,
    subscribeToScanEvents: (
      _scanId: string,
      onEvent: (event: unknown) => void,
      onStatusChange: (status: string) => void,
    ): ScanEventsSubscription => {
      subscription.onEvent = onEvent;
      onStatusChange("open");
      return { close: () => {} };
    },
  };
});

function Tracker({ scanId }: { scanId: string }) {
  const { trackScan } = useScanActivity();
  return (
    <button type="button" onClick={() => trackScan(scanId)}>
      track
    </button>
  );
}

describe("HistoryTable refresh on live scan end", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("refetches_immediately_when_the_tracked_scan_reaches_a_terminal_state", async () => {
    await loginAsSyntheticUser();
    const submitted = await submitScan("10.7.0.1");
    if (!submitted.ok) {
      throw new Error("setup failed");
    }
    const { scanId } = submitted.value;

    render(
      <ScanActivityProvider>
        <Tracker scanId={scanId} />
        <HistoryTable onViewReport={vi.fn()} />
      </ScanActivityProvider>,
    );
    const row = (await screen.findByText("10.7.0.1")).closest("tr");
    expect(row).toHaveTextContent("En cola");

    // Server state changes behind the table's back (no poll within the test).
    await cancelScan(scanId);
    expect(row).toHaveTextContent("En cola");

    act(() => {
      screen.getByRole("button", { name: "track" }).click();
    });
    act(() => {
      subscription.onEvent?.({
        status: "failed",
        correlation_id: scanId,
        reason: "x",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("10.7.0.1").closest("tr")).toHaveTextContent(
        "Falló",
      );
    });
  });

  it("does_not_refetch_while_the_tracked_scan_is_not_terminal", async () => {
    await loginAsSyntheticUser();
    const submitted = await submitScan("10.7.0.2");
    if (!submitted.ok) {
      throw new Error("setup failed");
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(
      <ScanActivityProvider>
        <Tracker scanId={submitted.value.scanId} />
        <HistoryTable onViewReport={vi.fn()} />
      </ScanActivityProvider>,
    );
    await screen.findByText("10.7.0.2");
    const historyCalls = () =>
      fetchSpy.mock.calls.filter(([input]) =>
        String(input).endsWith("/api/scans"),
      ).length;
    const before = historyCalls();

    act(() => {
      screen.getByRole("button", { name: "track" }).click();
    });
    act(() => {
      subscription.onEvent?.({ status: "started", correlation_id: "c" });
    });

    expect(historyCalls()).toBe(before);
    fetchSpy.mockRestore();
  });
});
