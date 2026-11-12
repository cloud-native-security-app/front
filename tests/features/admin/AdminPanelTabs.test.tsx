/** Tabs of the admin panel view: selection, unseen counts, state kept (AP-10). */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { AdminPanelView } from "../../../src/features/admin";
import { makeEvent, makeFinding, makeSnapshot } from "./fixtures";

const view = (snapshot = makeSnapshot()) => (
  <AdminPanelView snapshot={snapshot} status="live" />
);

describe("AdminPanelView tabs", () => {
  afterEach(() => {
    cleanup();
  });

  it("offers_the_three_sections_as_tabs_with_scans_selected_first", () => {
    render(view());
    expect(
      screen.getByRole("tablist", { name: "Actividad del panel" }),
    ).toBeInTheDocument();
    const names = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(names).toEqual([
      "Escaneos en curso",
      "Hallazgos críticos",
      "Registro de eventos",
    ]);
    expect(
      screen.getByRole("tab", { name: "Escaneos en curso" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("shows_the_count_of_findings_that_arrive_while_another_tab_is_selected_and_clears_it_on_select", async () => {
    const user = userEvent.setup();
    const { rerender } = render(view(makeSnapshot()));
    rerender(
      view(
        makeSnapshot({
          critical_findings: [makeFinding("f1"), makeFinding("f2")],
        }),
      ),
    );
    const tab = screen.getByRole("tab", {
      name: "Hallazgos críticos, 2 nuevos",
    });
    expect(tab).toHaveTextContent("2");

    await user.click(tab);
    const selected = screen.getByRole("tab", { name: "Hallazgos críticos" });
    expect(selected).toHaveAttribute("aria-selected", "true");
    expect(selected).toHaveTextContent(/^Hallazgos críticos$/);
  });

  it("does_not_count_items_already_present_on_first_render", () => {
    render(
      view(
        makeSnapshot({
          critical_findings: [makeFinding("f1")],
          recent_events: [makeEvent("e1")],
        }),
      ),
    );
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).not.toHaveAccessibleName(/nuevo/);
    }
  });

  it("counts_events_while_the_log_is_paused", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      view(makeSnapshot({ recent_events: [makeEvent("e1")] })),
    );
    await user.click(screen.getByRole("tab", { name: "Registro de eventos" }));
    await user.click(screen.getByRole("button", { name: "Pausar registro" }));
    await user.click(screen.getByRole("tab", { name: "Escaneos en curso" }));
    rerender(
      view(makeSnapshot({ recent_events: [makeEvent("e2"), makeEvent("e1")] })),
    );
    expect(
      screen.getByRole("tab", { name: "Registro de eventos, 1 nuevo" }),
    ).toBeInTheDocument();
  });

  it("keeps_the_log_paused_state_when_switching_tabs", async () => {
    const user = userEvent.setup();
    render(view(makeSnapshot({ recent_events: [makeEvent("e1")] })));
    await user.click(screen.getByRole("tab", { name: "Registro de eventos" }));
    await user.click(screen.getByRole("button", { name: "Pausar registro" }));
    await user.click(screen.getByRole("tab", { name: "Hallazgos críticos" }));
    await user.click(screen.getByRole("tab", { name: "Registro de eventos" }));
    const log = screen.getByRole("region", { name: "Registro de eventos" });
    expect(
      within(log).getByRole("button", { name: "Reanudar registro" }),
    ).toBeInTheDocument();
  });
});
