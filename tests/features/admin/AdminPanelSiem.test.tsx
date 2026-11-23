/** "Alertas IDS" tab of the admin panel view (SR-04). */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { AdminPanelView } from "../../../src/features/admin";
import { makeKpis, makeSiemAlert, makeSnapshot } from "./fixtures";

const view = (snapshot = makeSnapshot()) => (
  <AdminPanelView snapshot={snapshot} status="live" />
);

const enabled = (alerts = [makeSiemAlert("s1")]) =>
  makeSnapshot({
    siem_enabled: true,
    siem_alerts: alerts,
    kpis: makeKpis({
      siem_alerts: alerts.length,
      siem_alerts_by_severity: {
        low: 0,
        medium: 0,
        high: alerts.length,
        critical: 0,
      },
    }),
  });

describe("AdminPanelView SIEM tab", () => {
  afterEach(() => {
    cleanup();
  });

  it("hides_the_tab_when_siem_is_disabled", () => {
    render(view(makeSnapshot()));
    expect(
      screen.queryByRole("tab", { name: /Alertas IDS/ }),
    ).not.toBeInTheDocument();
  });

  it("shows_the_tab_last_when_siem_is_enabled_without_counting_the_snapshot_alerts", () => {
    render(view(enabled()));
    const tabs = screen.getAllByRole("tab");
    expect(tabs.at(-1)).toHaveAccessibleName("Alertas IDS");
  });

  it("counts_alerts_that_arrive_by_delta_and_clears_the_count_on_open", async () => {
    const user = userEvent.setup();
    const { rerender } = render(view(enabled()));
    rerender(view(enabled([makeSiemAlert("s2"), makeSiemAlert("s1")])));
    const tab = screen.getByRole("tab", { name: "Alertas IDS, 1 nuevo" });
    await user.click(tab);
    expect(screen.getByRole("tab", { name: "Alertas IDS" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("lists_alerts_with_severity_level_agent_ips_and_signature_and_the_summary", async () => {
    const user = userEvent.setup();
    render(
      view(
        enabled([
          makeSiemAlert("s1", {
            severity: "critical",
            rule_level: 14,
            description: "<img src=x onerror=alert(1)>",
            signature: "ET SCAN Nmap",
          }),
        ]),
      ),
    );
    await user.click(screen.getByRole("tab", { name: "Alertas IDS" }));
    const panel = screen.getByRole("tabpanel", { name: "Alertas IDS" });
    expect(within(panel).getByText("Crítica")).toBeInTheDocument();
    expect(within(panel).getByText(/nivel 14/i)).toBeInTheDocument();
    expect(within(panel).getByText("web-01")).toBeInTheDocument();
    expect(within(panel).getByText(/10\.0\.0\.5/)).toBeInTheDocument();
    expect(within(panel).getByText(/10\.0\.0\.9/)).toBeInTheDocument();
    expect(within(panel).getByText("ET SCAN Nmap")).toBeInTheDocument();
    // Rendered as text, never as HTML.
    expect(
      within(panel).getByText("<img src=x onerror=alert(1)>"),
    ).toBeInTheDocument();
    expect(panel.querySelector("img")).toBeNull();
    expect(
      within(panel).getByRole("list", { name: /Resumen por severidad/ }),
    ).toHaveTextContent("Crítica: 0");
  });

  it("shows_an_empty_state_without_alerts", async () => {
    const user = userEvent.setup();
    render(view(enabled([])));
    await user.click(screen.getByRole("tab", { name: "Alertas IDS" }));
    expect(screen.getByText("Sin alertas IDS recientes.")).toBeInTheDocument();
  });

  it("falls_back_to_the_default_tab_when_siem_turns_off_while_active", async () => {
    const user = userEvent.setup();
    const { rerender } = render(view(enabled()));
    await user.click(screen.getByRole("tab", { name: "Alertas IDS" }));
    rerender(view(makeSnapshot()));
    expect(
      screen.queryByRole("tab", { name: /Alertas IDS/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: "Escaneos en curso" }),
    ).toHaveAttribute("aria-selected", "true");
  });
});
