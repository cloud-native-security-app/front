/** Bounded lists and the pausable event log of the admin panel (AP-02). */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { AdminPanelView } from "../../../src/features/admin";
import { makeEvent, makeFinding, makeSnapshot } from "./fixtures";

const events = (ids: string[]) => ids.map((id) => makeEvent(id));

describe("AdminPanelView bounded lists", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders_the_three_lists_in_keyboard_scrollable_regions", () => {
    render(
      <AdminPanelView
        status="live"
        snapshot={makeSnapshot({
          recent_events: events(["e1"]),
          critical_findings: [makeFinding("f1")],
          scans_in_flight: [
            { scan_id: "s1", status: "running", since: "2026-11-11T10:00:00Z" },
          ],
        })}
      />,
    );
    for (const name of [
      "Lista desplazable de escaneos",
      "Lista desplazable de hallazgos",
      "Lista desplazable de eventos",
    ]) {
      const region = screen.getByRole("region", { name });
      expect(region).toHaveAttribute("tabindex", "0");
    }
  });

  it("shows_only_the_newest_50_scans_and_how_many_are_hidden", () => {
    const scans = Array.from({ length: 120 }, (_, i) => ({
      scan_id: `s${String(i)}`,
      status: "running" as const,
      since: "2026-11-11T10:00:00Z",
    }));
    render(
      <AdminPanelView
        status="live"
        snapshot={makeSnapshot({ scans_in_flight: scans })}
      />,
    );
    const table = screen.getByRole("table", { name: "Escaneos en curso" });
    expect(within(table).getAllByRole("row")).toHaveLength(51);
    expect(within(table).getByText("s119")).toBeInTheDocument();
    expect(within(table).queryByText("s0")).not.toBeInTheDocument();
    expect(screen.getByText("y 70 más")).toBeInTheDocument();
  });

  it("does_not_show_a_hidden_count_when_all_scans_fit", () => {
    render(
      <AdminPanelView
        status="live"
        snapshot={makeSnapshot({
          scans_in_flight: [
            { scan_id: "s1", status: "running", since: "2026-11-11T10:00:00Z" },
          ],
        })}
      />,
    );
    expect(screen.queryByText(/^y \d+ más$/)).not.toBeInTheDocument();
  });

  it("pausing_freezes_the_log_counts_new_events_and_resume_shows_the_latest", async () => {
    const user = userEvent.setup();
    const view = render(
      <AdminPanelView
        status="live"
        snapshot={makeSnapshot({ seq: 1, recent_events: events(["e2", "e1"]) })}
      />,
    );
    const log = () =>
      screen.getByRole("region", { name: "Registro de eventos" });

    await user.click(
      within(log()).getByRole("button", { name: "Pausar registro" }),
    );
    view.rerender(
      <AdminPanelView
        status="live"
        snapshot={makeSnapshot({
          seq: 3,
          recent_events: events(["e4", "e3", "e2", "e1"]),
        })}
      />,
    );

    const table = within(log()).getByRole("table");
    expect(within(table).queryByText("scan-e4")).not.toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(log()).getByText("2 eventos nuevos")).toBeInTheDocument();

    await user.click(
      within(log()).getByRole("button", { name: "Reanudar registro" }),
    );
    expect(within(log()).getAllByRole("row")).toHaveLength(5);
    expect(within(log()).queryByText(/eventos nuevos/)).not.toBeInTheDocument();
  });
});
