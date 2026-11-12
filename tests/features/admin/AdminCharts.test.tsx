/** The three admin charts (feature `admin-panel`, AP-06). */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AdminCharts } from "../../../src/features/admin/charts/AdminCharts";
import { makeSeries } from "./fixtures";

afterEach(() => {
  cleanup();
});

describe("AdminCharts", () => {
  const series = makeSeries({
    14: {
      by_type: {
        "scan.completed": 3,
        "scan.failed": 1,
        "audit.recorded": 2,
        "finding.critical": 3,
      },
      findings_by_severity: { high: 2, critical: 1 },
    },
  });

  it("renders_the_three_charts_with_their_legends", () => {
    render(<AdminCharts series={series} />);
    const section = screen.getByRole("region", { name: "Gráficos por minuto" });
    const figures = within(section).getAllByRole("figure");
    expect(figures.map((f) => f.getAttribute("aria-label") ?? "")).toEqual([
      "Eventos por minuto",
      "Escaneos completados y fallidos por minuto",
      "Hallazgos críticos por severidad y minuto",
    ]);
    const legends = within(section).getAllByRole("list", { name: "Leyenda" });
    expect(
      legends.map((l) => within(l).getAllByRole("listitem").length),
    ).toEqual([6, 2, 2]);
  });

  it("folds_low_volume_types_into_otros_and_keeps_status_series_labeled", () => {
    render(<AdminCharts series={series} />);
    const events = screen.getByRole("table", { name: "Eventos por minuto" });
    const headers = within(events)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toContain("Otros");
    const last = within(events).getAllByRole("row").at(-1)!;
    const cells = within(last)
      .getAllByRole("cell")
      .map((c) => c.textContent);
    expect(cells[headers.indexOf("Otros") - 1]).toBe("6");
    const severity = screen.getByRole("table", {
      name: "Hallazgos críticos por severidad y minuto",
    });
    expect(within(severity).getAllByRole("row").at(-1)).toHaveTextContent("2");
  });

  it("shows_an_empty_state_in_every_chart_without_series", () => {
    render(<AdminCharts series={undefined} />);
    expect(
      screen.getAllByText("Sin datos en los últimos 15 minutos."),
    ).toHaveLength(3);
  });
});
