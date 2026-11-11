/** Presentational admin panel (feature `admin-panel`, AP-04). */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { AdminPanelView } from "../../../src/features/admin";
import { makeEvent, makeFinding, makeKpis, makeSnapshot } from "./fixtures";

function renderView(
  snapshot = makeSnapshot(),
  status: "live" | "reconnecting" | "connecting" | "unavailable" = "live",
) {
  return render(<AdminPanelView snapshot={snapshot} status={status} />);
}

describe("AdminPanelView", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders_every_kpi_tile_with_its_label_and_value", () => {
    renderView(
      makeSnapshot({
        kpis: makeKpis({
          scans_in_flight: 2,
          completed_last_window: 7,
          failed_last_window: 1,
          failure_rate: 0.125,
          active_users: 4,
          rate_limit_hits: 9,
          malformed_records: 3,
        }),
      }),
    );

    const kpis = screen.getByRole("region", { name: "Indicadores" });
    const expected: Array<[string, string]> = [
      ["Escaneos en curso", "2"],
      ["Completados (últimos 15 min)", "7"],
      ["Fallidos (últimos 15 min)", "1"],
      ["Tasa de fallos", "12,5 %"],
      ["Usuarios activos", "4"],
      ["Límites de tasa alcanzados (últimos 15 min)", "9"],
      ["Registros malformados", "3"],
    ];
    for (const [label, value] of expected) {
      const term = within(kpis).getByText(label);
      expect(term.closest("div")).toHaveTextContent(value);
    }
  });

  it("shows_a_dash_for_an_undefined_failure_rate", () => {
    renderView(makeSnapshot({ kpis: makeKpis({ failure_rate: null }) }));
    expect(screen.getByText("Tasa de fallos").closest("div")).toHaveTextContent(
      "—",
    );
  });

  it("lists_scans_in_flight_with_status", () => {
    renderView(
      makeSnapshot({
        scans_in_flight: [
          {
            scan_id: "s-1",
            status: "requested",
            since: "2026-11-11T10:00:00Z",
          },
          { scan_id: "s-2", status: "running", since: "2026-11-11T10:01:00Z" },
        ],
      }),
    );
    const table = screen.getByRole("table", { name: "Escaneos en curso" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("s-1");
    expect(rows[0]).toHaveTextContent("Solicitado");
    expect(rows[1]).toHaveTextContent("En ejecución");
  });

  it("shows_empty_messages_for_empty_lists", () => {
    renderView();
    expect(screen.getByText("No hay escaneos en curso.")).toBeInTheDocument();
    expect(
      screen.getByText("Sin hallazgos críticos recientes."),
    ).toBeInTheDocument();
    expect(screen.getByText("Todavía no hay eventos.")).toBeInTheDocument();
  });

  it("renders_critical_findings_newest_first_with_port_or_host", () => {
    renderView(
      makeSnapshot({
        critical_findings: [
          makeFinding("new", { port: null, protocol: null, cve_id: null }),
          makeFinding("old", { port: 443, protocol: "tcp" }),
        ],
      }),
    );

    const feed = screen.getByRole("list", { name: "Hallazgos críticos" });
    const items = within(feed).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Host");
    expect(items[0]).not.toHaveTextContent(/puerto/i);
    expect(items[1]).toHaveTextContent("Puerto 443/tcp");
    expect(items[1]).toHaveTextContent("CVE-2024-6387");
  });

  it("announces_only_the_newest_new_finding_in_a_polite_live_region", () => {
    const { rerender } = renderView(
      makeSnapshot({ critical_findings: [makeFinding("a")] }),
    );
    const region = screen.getByRole("status", {
      name: "Avisos de hallazgos críticos",
    });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();

    rerender(
      <AdminPanelView
        status="live"
        snapshot={makeSnapshot({
          seq: 2,
          critical_findings: [
            makeFinding("b", { port: 8080, protocol: "tcp", cve_id: "CVE-1" }),
            makeFinding("a"),
          ],
        })}
      />,
    );
    expect(region).toHaveTextContent(
      "Nuevo hallazgo crítico: CVE-1 en el puerto 8080/tcp",
    );

    rerender(
      <AdminPanelView
        status="live"
        snapshot={makeSnapshot({
          seq: 3,
          critical_findings: [
            makeFinding("b", { port: 8080, protocol: "tcp", cve_id: "CVE-1" }),
            makeFinding("a"),
          ],
        })}
      />,
    );
    expect(region).toHaveTextContent("CVE-1");
  });

  it("describes_a_host_level_finding_in_the_announcement", () => {
    const { rerender } = renderView();
    rerender(
      <AdminPanelView
        status="live"
        snapshot={makeSnapshot({
          seq: 2,
          critical_findings: [
            makeFinding("h", { port: null, protocol: null, cve_id: null }),
          ],
        })}
      />,
    );
    expect(
      screen.getByRole("status", { name: "Avisos de hallazgos críticos" }),
    ).toHaveTextContent("en el host");
  });

  it("filters_the_event_log_by_type_with_a_keyboard_usable_select", async () => {
    renderView(
      makeSnapshot({
        recent_events: [
          makeEvent("1", { event_type: "scan.completed" }),
          makeEvent("2", { event_type: "ratelimit.hit", scan_id: undefined }),
          makeEvent("3", { event_type: "scan.completed" }),
        ],
      }),
    );
    const log = screen.getByRole("region", { name: "Registro de eventos" });
    expect(within(log).getAllByRole("row")).toHaveLength(4);

    const select = within(log).getByRole("combobox", {
      name: "Tipo de evento",
    });
    await userEvent.selectOptions(select, "ratelimit.hit");

    const rows = within(log).getAllByRole("row");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent("ratelimit.hit");
    expect(log).toHaveTextContent("Mostrando 1 de 3");

    await userEvent.selectOptions(select, "");
    expect(within(log).getAllByRole("row")).toHaveLength(4);
  });

  it("never_renders_the_actor_sub", () => {
    renderView(
      makeSnapshot({
        recent_events: [makeEvent("1", { actor_sub: "sub-secreto-123" })],
      }),
    );
    expect(screen.queryByText(/sub-secreto-123/)).not.toBeInTheDocument();
  });

  it("flags_stale_data_while_not_live", () => {
    renderView(makeSnapshot(), "reconnecting");
    expect(
      screen.getByRole("status", { name: "Estado de la conexión" }),
    ).toHaveTextContent(/reconectando/i);
    expect(
      screen.getByRole("status", { name: "Estado de la conexión" }),
    ).toHaveTextContent(/desactualizados/i);
  });

  it("shows_live_connection_state", () => {
    renderView();
    expect(
      screen.getByRole("status", { name: "Estado de la conexión" }),
    ).toHaveTextContent("En vivo");
  });
});
