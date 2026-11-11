import { ADMIN_KPI_SECTION_LABEL, kpiLabels } from "../../copy";
import type { AdminKpis } from "../../api";
import { formatFailureRate } from "./formatters";

export function KpiTiles({
  kpis,
  windowSeconds,
}: {
  kpis: AdminKpis;
  windowSeconds: number;
}) {
  const labels = kpiLabels(Math.round(windowSeconds / 60));
  const tiles: Array<[string, string]> = [
    [labels.scansInFlight, String(kpis.scans_in_flight)],
    [labels.completed, String(kpis.completed_last_window)],
    [labels.failed, String(kpis.failed_last_window)],
    [labels.failureRate, formatFailureRate(kpis.failure_rate)],
    [labels.activeUsers, String(kpis.active_users)],
    [labels.rateLimitHits, String(kpis.rate_limit_hits)],
    [labels.malformed, String(kpis.malformed_records)],
  ];

  return (
    <section aria-label={ADMIN_KPI_SECTION_LABEL}>
      <dl className="kpi-grid">
        {tiles.map(([label, value]) => (
          <div className="kpi-tile" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
