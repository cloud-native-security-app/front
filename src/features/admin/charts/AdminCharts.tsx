/**
 * The three per-minute charts of the admin panel (feature `admin-panel`,
 * AP-06), placed between the KPIs and the lists:
 * - events per minute: stacked columns by event type (identity -> categorical
 *   colors, fixed per type; the long tail folds into "Otros"; critical
 *   findings are left out, they have the third chart);
 * - scans completed vs failed: grouped columns, one axis (the two series MEAN
 *   good/bad -> status tokens, with check/cross icons);
 * - critical findings by severity: stacked columns (status tokens: serious =
 *   high, critical = critical, with triangle/diamond icons).
 * Without `series` (older backend) each chart shows its empty state.
 */

import type { AdminSeries } from "../../../api";
import {
  ADMIN_CHARTS_SECTION_LABEL,
  ADMIN_CHART_EMPTY_MESSAGE,
  ADMIN_CHART_EVENTS_TITLE,
  ADMIN_CHART_FINDINGS_TITLE,
  ADMIN_CHART_SCANS_TITLE,
  ADMIN_EVENT_TYPE_SERIES_LABEL,
  ADMIN_SCAN_OUTCOME_LABEL,
  ADMIN_SEVERITY_LABEL,
} from "../../../copy";
import {
  CHART_EVENT_TYPES,
  OTHER_KEY,
  foldEventTypes,
  scanOutcomes,
  severityCounts,
} from "../series";
import { BarChart, type ChartColumn, type ChartSeriesDef } from "./BarChart";

const EVENT_SERIES: ChartSeriesDef[] = [
  ...CHART_EVENT_TYPES.map((type, i) => ({
    key: type,
    label: ADMIN_EVENT_TYPE_SERIES_LABEL[type],
    tone: `series-${String(i + 1)}`,
  })),
  { key: OTHER_KEY, label: ADMIN_EVENT_TYPE_SERIES_LABEL.other, tone: "other" },
];

const SCAN_SERIES: ChartSeriesDef[] = [
  {
    key: "completed",
    label: ADMIN_SCAN_OUTCOME_LABEL.completed,
    tone: "status-good",
    icon: "check",
  },
  {
    key: "failed",
    label: ADMIN_SCAN_OUTCOME_LABEL.failed,
    tone: "status-critical",
    icon: "cross",
  },
];

/** Bottom to top: critical anchors the stack. */
const SEVERITY_SERIES: ChartSeriesDef[] = [
  {
    key: "critical",
    label: ADMIN_SEVERITY_LABEL.critical,
    tone: "status-critical",
    icon: "diamond",
  },
  {
    key: "high",
    label: ADMIN_SEVERITY_LABEL.high,
    tone: "status-serious",
    icon: "triangle",
  },
];

function toColumns(
  series: AdminSeries | null | undefined,
  rows: Array<Record<string, number | undefined>>,
): ChartColumn[] {
  if (!series) {
    return [];
  }
  return series.buckets.map((bucket, i) => ({
    minute: bucket.minute,
    values: Object.fromEntries(
      Object.entries(rows[i] ?? {}).filter(
        (entry): entry is [string, number] => entry[1] !== undefined,
      ),
    ),
  }));
}

export function AdminCharts({
  series,
}: {
  series: AdminSeries | null | undefined;
}) {
  const types = series?.buckets.map((b) => b.by_type) ?? [];
  const severities = series?.buckets.map((b) => b.findings_by_severity) ?? [];
  return (
    <section aria-label={ADMIN_CHARTS_SECTION_LABEL}>
      <div className="chart-grid">
        <BarChart
          title={ADMIN_CHART_EVENTS_TITLE}
          series={EVENT_SERIES}
          columns={toColumns(series, foldEventTypes(types))}
          mode="stacked"
          emptyMessage={ADMIN_CHART_EMPTY_MESSAGE}
        />
        <BarChart
          title={ADMIN_CHART_SCANS_TITLE}
          series={SCAN_SERIES}
          columns={toColumns(series, scanOutcomes(types))}
          mode="grouped"
          emptyMessage={ADMIN_CHART_EMPTY_MESSAGE}
        />
        <BarChart
          title={ADMIN_CHART_FINDINGS_TITLE}
          series={SEVERITY_SERIES}
          columns={toColumns(series, severityCounts(severities))}
          mode="stacked"
          emptyMessage={ADMIN_CHART_EMPTY_MESSAGE}
        />
      </div>
    </section>
  );
}
