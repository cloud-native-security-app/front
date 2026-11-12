/** Generic inline-SVG bar chart (feature `admin-panel`, AP-06). */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  BarChart,
  type ChartColumn,
  type ChartSeriesDef,
} from "../../../src/features/admin/charts/BarChart";

const SERIES: ChartSeriesDef[] = [
  { key: "a", label: "Alfa", tone: "series-1" },
  { key: "b", label: "Beta", tone: "series-2" },
];

function columns(values: Array<Record<string, number>>): ChartColumn[] {
  return values.map((v, i) => ({
    minute: `2026-11-11T23:${String(i).padStart(2, "0")}:00Z`,
    values: v,
  }));
}

const DATA = columns([
  { a: 2, b: 1 },
  {},
  { a: 5 },
  ...Array.from({ length: 12 }, () => ({})),
]);

function renderChart(
  mode: "stacked" | "grouped" = "stacked",
  data: ChartColumn[] = DATA,
) {
  return render(
    <BarChart
      title="Eventos"
      series={SERIES}
      columns={data}
      mode={mode}
      emptyMessage="Sin datos"
    />,
  );
}

describe("BarChart", () => {
  afterEach(() => {
    cleanup();
  });

  it("draws_one_bar_per_non_zero_value", () => {
    const { container } = renderChart();
    expect(container.querySelectorAll("[data-bar]")).toHaveLength(3);
  });

  it("grouped_mode_draws_the_same_bars_side_by_side", () => {
    const { container } = renderChart("grouped");
    const bars = [...container.querySelectorAll("[data-bar]")];
    expect(bars).toHaveLength(3);
    const first = bars.filter((b) => b.getAttribute("data-col") === "0");
    const xs = first.map((b) => b.getAttribute("data-x"));
    expect(new Set(xs).size).toBe(2);
  });

  it("titles_the_figure_and_lists_one_legend_entry_per_series", () => {
    renderChart();
    expect(screen.getByRole("figure", { name: "Eventos" })).toBeInTheDocument();
    const legend = screen.getByRole("list", { name: "Leyenda" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(2);
    expect(within(legend).getByText("Alfa")).toBeInTheDocument();
  });

  it("offers_a_table_with_one_row_per_minute_and_a_column_per_series", () => {
    renderChart();
    const table = screen.getByRole("table", { name: "Eventos" });
    expect(within(table).getAllByRole("row")).toHaveLength(16);
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Minuto", "Alfa", "Beta"]);
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("2");
  });

  it("shows_an_empty_state_when_every_value_is_zero", () => {
    const { container } = renderChart(
      "stacked",
      columns(Array.from({ length: 15 }, () => ({}))),
    );
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-bar]")).toHaveLength(0);
  });

  it("shows_every_series_value_of_the_hovered_minute_in_a_tooltip", () => {
    const { container } = renderChart();
    expect(screen.queryByTestId("chart-tooltip")).not.toBeInTheDocument();

    fireEvent.pointerEnter(container.querySelector('[data-hit="0"]')!);

    const tip = screen.getByTestId("chart-tooltip");
    expect(tip).toHaveTextContent("Alfa");
    expect(tip).toHaveTextContent("2");
    expect(tip).toHaveTextContent("Beta");
    expect(tip).toHaveTextContent("1");

    fireEvent.pointerLeave(container.querySelector('[data-hit="0"]')!);
    expect(screen.queryByTestId("chart-tooltip")).not.toBeInTheDocument();
  });

  it("is_keyboard_reachable_arrow_keys_move_between_minutes_and_escape_closes", () => {
    renderChart();
    const plot = screen.getByRole("group", { name: /Eventos/ });
    fireEvent.focus(plot);
    expect(screen.getByTestId("chart-tooltip")).toHaveTextContent("Alfa");

    fireEvent.keyDown(plot, { key: "Home" });
    fireEvent.keyDown(plot, { key: "ArrowRight" });
    fireEvent.keyDown(plot, { key: "ArrowRight" });
    expect(screen.getByTestId("chart-tooltip")).toHaveTextContent("5");

    fireEvent.keyDown(plot, { key: "Escape" });
    expect(screen.queryByTestId("chart-tooltip")).not.toBeInTheDocument();
  });

  it("renders_series_names_as_text_not_markup", () => {
    render(
      <BarChart
        title="X"
        series={[
          { key: "a", label: "<img src=x onerror=alert(1)>", tone: "series-1" },
          SERIES[1]!,
        ]}
        columns={DATA}
        mode="stacked"
        emptyMessage="Sin datos"
      />,
    );
    expect(document.querySelector("img")).toBeNull();
  });
});
