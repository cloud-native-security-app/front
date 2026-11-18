/**
 * Cancel from the scan page (feature `scan-live-status`, SC-03).
 * `subscribeToScanEvents` is stubbed for the jsdom/EventSource reason
 * documented in `ScanForm.test.tsx`; `cancelScan`/`submitScan` hit the real
 * contract server.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  cancelScan,
  createNetworkCredential,
  getScanHistory,
  submitScan,
  type ScanEventsSubscription,
} from "../../../src/api";
import { SessionProvider } from "../../../src/auth";
import { CANCEL_CONFLICT_MESSAGE } from "../../../src/copy";
import { HistoryTable } from "../../../src/features/history";
import {
  ScanActivityProvider,
  ScanForm,
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

const CANCEL_BUTTON = "Cancelar escaneo";

async function seedTarget(target: string): Promise<void> {
  const created = await createNetworkCredential({
    target_pattern: target,
    network_user: "root",
    ssh_credentials_ref: "vault://ssh/test-key",
    has_sudo: false,
  });
  if (!created.ok) {
    throw new Error("setup failed: could not seed a target");
  }
}

function renderForm(extra?: React.ReactNode) {
  return render(
    <SessionProvider>
      <MemoryRouter>
        <ScanActivityProvider>
          <ScanForm />
          {extra}
        </ScanActivityProvider>
      </MemoryRouter>
    </SessionProvider>,
  );
}

async function startScan(target: string) {
  await userEvent.selectOptions(
    await screen.findByLabelText("Objetivo a escanear"),
    target,
  );
  await userEvent.click(screen.getByRole("button", { name: "Escanear" }));
  await screen.findByText(/escaneo en cola/i);
}

describe("scan page cancel", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows_the_cancel_button_only_while_the_scan_is_running", async () => {
    await loginAsSyntheticUser();
    await seedTarget("10.30.0.1");
    renderForm();
    expect(
      screen.queryByRole("button", { name: CANCEL_BUTTON }),
    ).not.toBeInTheDocument();

    await startScan("10.30.0.1");
    expect(
      screen.getByRole("button", { name: CANCEL_BUTTON }),
    ).toBeInTheDocument();

    act(() => {
      subscription.onEvent?.({
        status: "completed",
        correlation_id: "c",
        result: {
          target: "10.30.0.1",
          scanned_at: "",
          ports: [],
          vulnerabilities: [],
        },
      });
    });
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: CANCEL_BUTTON }),
      ).not.toBeInTheDocument();
    });
  });

  it("shows_cancelado_right_after_a_successful_cancel", async () => {
    await loginAsSyntheticUser();
    await seedTarget("10.30.0.2");
    renderForm();
    await startScan("10.30.0.2");

    await userEvent.click(screen.getByRole("button", { name: CANCEL_BUTTON }));

    await waitFor(() => {
      expect(screen.getByText("Cancelado")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: CANCEL_BUTTON }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/sin conexión/)).not.toBeInTheDocument();
  });

  it("disables_the_button_while_the_cancel_is_pending", async () => {
    await loginAsSyntheticUser();
    await seedTarget("10.30.0.3");
    renderForm();
    await startScan("10.30.0.3");

    const realFetch = globalThis.fetch;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (String(input).endsWith("/cancel")) {
        await gate;
      }
      return realFetch(input, init);
    });

    await userEvent.click(screen.getByRole("button", { name: CANCEL_BUTTON }));
    expect(screen.getByRole("button", { name: CANCEL_BUTTON })).toBeDisabled();
    release();
    await screen.findByText("Cancelado");
    vi.restoreAllMocks();
  });

  it("shows_the_shared_conflict_message_when_the_scan_already_finished", async () => {
    await loginAsSyntheticUser();
    await seedTarget("10.30.0.4");
    renderForm();
    await startScan("10.30.0.4");
    // The scan id is not exposed, so finish it server-side through history.
    const entries = await getScanHistory();
    if (!entries.ok) {
      throw new Error("setup failed");
    }
    const entry = entries.value.find((e) => e.target === "10.30.0.4");
    await cancelScan(entry?.scanId ?? "");

    await userEvent.click(screen.getByRole("button", { name: CANCEL_BUTTON }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      CANCEL_CONFLICT_MESSAGE,
    );
    expect(screen.getByRole("button", { name: CANCEL_BUTTON })).toBeEnabled();
  });

  it("shows_the_session_message_when_the_session_expired", async () => {
    await loginAsSyntheticUser();
    await seedTarget("10.30.0.5");
    renderForm();
    await startScan("10.30.0.5");
    clearNodeTestSessionCookies();

    await userEvent.click(screen.getByRole("button", { name: CANCEL_BUTTON }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /tu sesión ya no es válida/i,
    );
  });
});

function Probe({ scanId }: { scanId: string }) {
  const activity = useScanActivity();
  return (
    <>
      <button type="button" onClick={() => activity.trackScan(scanId)}>
        track
      </button>
      <button type="button" onClick={() => activity.markScanCancelled(scanId)}>
        mark
      </button>
      <button
        type="button"
        onClick={() => activity.markScanCancelled("other-scan")}
      >
        mark-other
      </button>
      <output data-testid="status">{activity.status}</output>
      <output data-testid="finished">{activity.finishedScanId ?? "-"}</output>
    </>
  );
}

describe("ScanActivityProvider.markScanCancelled", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("sets_cancelado_only_for_the_tracked_scan_and_keeps_it_over_late_events", async () => {
    render(
      <ScanActivityProvider>
        <Probe scanId="abc" />
      </ScanActivityProvider>,
    );
    act(() => screen.getByRole("button", { name: "track" }).click());
    act(() => screen.getByRole("button", { name: "mark-other" }).click());
    expect(screen.getByTestId("status")).toHaveTextContent("PENDIENTE");

    act(() => screen.getByRole("button", { name: "mark" }).click());
    expect(screen.getByTestId("status")).toHaveTextContent("CANCELADO");
    expect(screen.getByTestId("finished")).toHaveTextContent("abc");

    act(() => {
      subscription.onEvent?.({ status: "started", correlation_id: "abc" });
    });
    expect(screen.getByTestId("status")).toHaveTextContent("CANCELADO");
  });

  it("maps_a_cancelled_sse_event_to_cancelado", async () => {
    render(
      <ScanActivityProvider>
        <Probe scanId="abc" />
      </ScanActivityProvider>,
    );
    act(() => screen.getByRole("button", { name: "track" }).click());
    act(() => {
      subscription.onEvent?.({
        status: "cancelled",
        correlation_id: "abc",
        reason: "x",
      });
    });
    expect(screen.getByTestId("status")).toHaveTextContent("CANCELADO");
  });
});

describe("cancel from the history table", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("updates_the_scan_page_when_the_cancelled_scan_is_the_active_one", async () => {
    await loginAsSyntheticUser();
    const submitted = await submitScan("10.31.0.1");
    if (!submitted.ok) {
      throw new Error("setup failed");
    }
    render(
      <ScanActivityProvider>
        <Probe scanId={submitted.value.scanId} />
        <HistoryTable onViewReport={vi.fn()} />
      </ScanActivityProvider>,
    );
    act(() => screen.getByRole("button", { name: "track" }).click());
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Cancelar escaneo de 10.31.0.1",
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("CANCELADO");
    });
  });

  it("leaves_the_scan_page_alone_when_another_scan_is_cancelled", async () => {
    await loginAsSyntheticUser();
    const active = await submitScan("10.31.0.2");
    const other = await submitScan("10.31.0.3");
    if (!active.ok || !other.ok) {
      throw new Error("setup failed");
    }
    render(
      <ScanActivityProvider>
        <Probe scanId={active.value.scanId} />
        <HistoryTable onViewReport={vi.fn()} />
      </ScanActivityProvider>,
    );
    act(() => screen.getByRole("button", { name: "track" }).click());
    await userEvent.click(
      await screen.findByRole("button", {
        name: "Cancelar escaneo de 10.31.0.3",
      }),
    );
    await waitFor(() => {
      expect(screen.getByText("10.31.0.3").closest("tr")).toHaveTextContent(
        "Cancelado",
      );
    });
    expect(screen.getByTestId("status")).toHaveTextContent("PENDIENTE");
  });
});
