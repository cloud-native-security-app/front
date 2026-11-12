/**
 * Inline-SVG column chart (feature `admin-panel`, AP-06): stacked or grouped,
 * one y axis, recessive grid, sparse minute labels on x, legend, per-minute
 * tooltip (pointer and keyboard) and a table twin of the same data. Colors are
 * CSS tokens (`--chart-*` in `src/index.css`) picked through a tone class, so
 * the markup carries no inline styles. Text never wears a series color.
 */

import { useId, useState, type KeyboardEvent } from "react";

import {
  ADMIN_CHART_KEYBOARD_HINT,
  ADMIN_CHART_LEGEND_LABEL,
  ADMIN_CHART_MINUTE_COLUMN,
  ADMIN_CHART_TABLE_TOGGLE,
} from "../../../copy";
import { formatMinuteLabel } from "../formatters";
import { niceScale } from "../series";
import { SeriesKey, type SeriesIcon } from "./SeriesKey";

export interface ChartSeriesDef {
  key: string;
  label: string;
  /** Suffix of the `chart-tone--*` class (the token that colors the mark). */
  tone: string;
  /** Status series wear an icon next to their label, never color alone. */
  icon?: SeriesIcon;
}

export interface ChartColumn {
  /** ISO minute of the bucket. */
  minute: string;
  values: Record<string, number>;
}

interface Props {
  title: string;
  series: ChartSeriesDef[];
  columns: ChartColumn[];
  mode: "stacked" | "grouped";
  emptyMessage: string;
}

const W = 320;
const H = 200;
const M = { l: 30, r: 6, t: 16, b: 22 };
const PLOT_W = W - M.l - M.r;
const PLOT_H = H - M.t - M.b;
const GAP = 2;
const MAX_BAR = 24;
const RADIUS = 4;
/** One x label every this many minutes, counted back from the newest. */
const LABEL_EVERY = 4;

/** Bar with a rounded data end (top) and a square base. */
function barPath(x: number, y: number, w: number, h: number, round: boolean) {
  const r = round ? Math.min(RADIUS, h, w / 2) : 0;
  return (
    `M${String(x)},${String(y + h)}V${String(y + r)}` +
    (r > 0
      ? `a${String(r)},${String(r)} 0 0 1 ${String(r)},${String(-r)}`
      : "") +
    `H${String(x + w - r)}` +
    (r > 0
      ? `a${String(r)},${String(r)} 0 0 1 ${String(r)},${String(r)}`
      : "") +
    `V${String(y + h)}Z`
  );
}

interface Bar {
  key: string;
  tone: string;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  round: boolean;
  value: number;
}

function layout(
  series: ChartSeriesDef[],
  columns: ChartColumn[],
  mode: Props["mode"],
  max: number,
): Bar[] {
  const band = PLOT_W / columns.length;
  const scale = (v: number) => (v / max) * PLOT_H;
  const bars: Bar[] = [];
  columns.forEach((column, col) => {
    const present = series.filter((s) => (column.values[s.key] ?? 0) > 0);
    if (mode === "stacked") {
      const w = Math.min(MAX_BAR, band - GAP * 2);
      const x = M.l + col * band + (band - w) / 2;
      let cumulative = 0;
      present.forEach((s, i) => {
        const value = column.values[s.key] ?? 0;
        const top = M.t + PLOT_H - scale(cumulative + value);
        const bottom =
          M.t + PLOT_H - scale(cumulative) - (cumulative > 0 ? GAP : 0);
        bars.push({
          key: s.key,
          tone: s.tone,
          col,
          x,
          y: top,
          w,
          h: Math.max(1, bottom - top),
          round: i === present.length - 1,
          value,
        });
        cumulative += value;
      });
    } else {
      const w = Math.min(
        MAX_BAR,
        (band - GAP * 2 - GAP * (series.length - 1)) / series.length,
      );
      const groupW = w * series.length + GAP * (series.length - 1);
      series.forEach((s, i) => {
        const value = column.values[s.key] ?? 0;
        if (value <= 0) {
          return;
        }
        const h = Math.max(1, scale(value));
        bars.push({
          key: s.key,
          tone: s.tone,
          col,
          x: M.l + col * band + (band - groupW) / 2 + i * (w + GAP),
          y: M.t + PLOT_H - h,
          w,
          h,
          round: true,
          value,
        });
      });
    }
  });
  return bars;
}

function total(column: ChartColumn, series: ChartSeriesDef[]): number {
  return series.reduce((sum, s) => sum + (column.values[s.key] ?? 0), 0);
}

export function BarChart({
  title,
  series,
  columns,
  mode,
  emptyMessage,
}: Props) {
  const id = useId();
  const [active, setActive] = useState<number | undefined>(undefined);
  const count = columns.length;
  const peak = Math.max(
    0,
    ...columns.map((c) =>
      mode === "stacked"
        ? total(c, series)
        : Math.max(0, ...series.map((s) => c.values[s.key] ?? 0)),
    ),
  );
  const { max, ticks } = niceScale(peak);
  const bars = layout(series, columns, mode, max);
  const empty = peak === 0;
  const band = count > 0 ? PLOT_W / count : PLOT_W;
  const newest = count - 1;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const from = active ?? newest;
    const next: Record<string, number | undefined> = {
      ArrowLeft: Math.max(0, from - 1),
      ArrowRight: Math.min(newest, from + 1),
      Home: 0,
      End: newest,
      Escape: undefined,
    };
    if (event.key in next) {
      event.preventDefault();
      setActive(next[event.key]);
    }
  }

  const activeColumn = active === undefined ? undefined : columns[active];
  const tipLeft =
    active === undefined ? 0 : ((M.l + (active + 0.5) * band) / W) * 100;
  const tipEnd = active !== undefined && active >= count / 2;

  return (
    <figure className="chart" aria-label={title}>
      <figcaption className="chart__title">{title}</figcaption>
      <ul className="chart__legend" aria-label={ADMIN_CHART_LEGEND_LABEL}>
        {series.map((s) => (
          <li key={s.key} className={`chart-tone--${s.tone}`}>
            <SeriesKey icon={s.icon} />
            <span>{s.label}</span>
          </li>
        ))}
      </ul>
      <div className="chart__plot-wrap">
        <div
          className="chart__plot"
          role="group"
          tabIndex={0}
          aria-label={`${title}. ${ADMIN_CHART_KEYBOARD_HINT}`}
          onKeyDown={onKeyDown}
          onFocus={() => {
            setActive((current) => current ?? newest);
          }}
          onBlur={() => {
            setActive(undefined);
          }}
        >
          <svg
            viewBox={`0 0 ${String(W)} ${String(H)}`}
            aria-hidden="true"
            focusable="false"
          >
            {ticks.map((tick) => {
              const y = M.t + PLOT_H - (tick / max) * PLOT_H;
              return (
                <g key={tick}>
                  <line
                    className={tick === 0 ? "chart__axis" : "chart__grid"}
                    x1={M.l}
                    x2={W - M.r}
                    y1={y}
                    y2={y}
                  />
                  <text
                    className="chart__tick"
                    x={M.l - 4}
                    y={y + 3.5}
                    textAnchor="end"
                  >
                    {tick}
                  </text>
                </g>
              );
            })}
            {activeColumn && active !== undefined ? (
              <rect
                className="chart__active"
                x={M.l + active * band}
                y={M.t}
                width={band}
                height={PLOT_H}
              />
            ) : null}
            {bars.map((bar) => (
              <path
                key={`${String(bar.col)}-${bar.key}`}
                className={`chart__bar chart-tone--${bar.tone}`}
                data-bar=""
                data-col={bar.col}
                data-key={bar.key}
                data-x={bar.x}
                d={barPath(bar.x, bar.y, bar.w, bar.h, bar.round)}
              />
            ))}
            {columns.map((column, i) =>
              (count - 1 - i) % LABEL_EVERY === 0 ? (
                <text
                  key={column.minute}
                  className="chart__tick"
                  x={M.l + (i + 0.5) * band}
                  y={H - 6}
                  textAnchor="middle"
                >
                  {formatMinuteLabel(column.minute)}
                </text>
              ) : null,
            )}
            {!empty && columns[newest]
              ? mode === "stacked"
                ? total(columns[newest], series) > 0 && (
                    <text
                      className="chart__value"
                      x={M.l + (newest + 0.5) * band}
                      y={
                        M.t +
                        PLOT_H -
                        (total(columns[newest], series) / max) * PLOT_H -
                        4
                      }
                      textAnchor="middle"
                    >
                      {total(columns[newest], series)}
                    </text>
                  )
                : bars
                    .filter((b) => b.col === newest)
                    .map((b) => (
                      <text
                        key={b.key}
                        className="chart__value"
                        x={b.x + b.w / 2}
                        y={b.y - 4}
                        textAnchor="middle"
                      >
                        {b.value}
                      </text>
                    ))
              : null}
            {empty ? (
              <text
                className="chart__empty"
                x={M.l + PLOT_W / 2}
                y={M.t + PLOT_H / 2}
                textAnchor="middle"
              >
                {emptyMessage}
              </text>
            ) : null}
            {columns.map((_, i) => (
              <rect
                key={i}
                className="chart__hit"
                data-hit={i}
                x={M.l + i * band}
                y={M.t}
                width={band}
                height={PLOT_H}
                onPointerEnter={() => {
                  setActive(i);
                }}
                onPointerMove={() => {
                  setActive(i);
                }}
                onPointerLeave={() => {
                  setActive(undefined);
                }}
              />
            ))}
          </svg>
          <div className="chart__live" aria-live="polite">
            {activeColumn ? (
              <div
                className={`chart__tooltip${tipEnd ? " chart__tooltip--end" : ""}`}
                data-testid="chart-tooltip"
                style={{ left: `${String(tipLeft)}%` }}
              >
                <strong className="chart__tooltip-time">
                  {formatMinuteLabel(activeColumn.minute)}
                </strong>
                <ul>
                  {series.map((s) => (
                    <li key={s.key} className={`chart-tone--${s.tone}`}>
                      <SeriesKey icon={s.icon} />
                      <strong>{activeColumn.values[s.key] ?? 0}</strong>
                      <span>{s.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <details className="chart__table">
        <summary>{ADMIN_CHART_TABLE_TOGGLE}</summary>
        <div
          className="chart__table-scroll"
          role="region"
          tabIndex={0}
          aria-label={`${title} (tabla)`}
        >
          <table aria-label={title} id={`${id}-table`}>
            <thead>
              <tr>
                <th scope="col">{ADMIN_CHART_MINUTE_COLUMN}</th>
                {series.map((s) => (
                  <th scope="col" key={s.key}>
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map((column) => (
                <tr key={column.minute}>
                  <th scope="row">{formatMinuteLabel(column.minute)}</th>
                  {series.map((s) => (
                    <td key={s.key}>{column.values[s.key] ?? 0}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
