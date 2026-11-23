/**
 * IDS (SIEM) alerts, newest first, with a per-severity count summary. Every
 * field is rendered as React text (never as HTML): descriptions and
 * signatures come from an external system.
 */

import type { AdminSiemAlert, AdminSiemSeverityCounts } from "../../api";
import {
  ADMIN_NO_SIEM_ALERTS_MESSAGE,
  ADMIN_SIEM_AGENT_LABEL,
  ADMIN_SIEM_DEST_LABEL,
  ADMIN_SIEM_REGION_LABEL,
  ADMIN_SIEM_SEVERITY_LABEL,
  ADMIN_SIEM_SIGNATURE_LABEL,
  ADMIN_SIEM_SRC_LABEL,
  ADMIN_SIEM_SUMMARY_LABEL,
  ADMIN_SIEM_TITLE,
  adminSiemRuleLevel,
} from "../../copy";
import { formatTime } from "./formatters";

const ORDER = ["critical", "high", "medium", "low"] as const;

export function SiemAlertsPanel({
  alerts,
  counts,
}: {
  alerts: AdminSiemAlert[];
  counts: AdminSiemSeverityCounts;
}) {
  return (
    <section aria-labelledby="admin-siem-title">
      <h3 id="admin-siem-title">{ADMIN_SIEM_TITLE}</h3>
      <ul className="severity-summary" aria-label={ADMIN_SIEM_SUMMARY_LABEL}>
        {ORDER.map((severity) => (
          <li key={severity}>
            <span className="severity-badge" data-severity={severity}>
              {`${ADMIN_SIEM_SEVERITY_LABEL[severity]}: ${String(counts[severity])}`}
            </span>
          </li>
        ))}
      </ul>
      {alerts.length === 0 ? (
        <p>{ADMIN_NO_SIEM_ALERTS_MESSAGE}</p>
      ) : (
        <div
          className="admin-region"
          role="region"
          tabIndex={0}
          aria-label={ADMIN_SIEM_REGION_LABEL}
        >
          <ol className="finding-list" aria-label={ADMIN_SIEM_TITLE}>
            {alerts.map((alert) => (
              <li
                key={alert.event_id}
                className="finding-card"
                data-severity={alert.severity}
              >
                <div className="finding-card-header">
                  <span
                    className="severity-badge"
                    data-severity={alert.severity}
                  >
                    {ADMIN_SIEM_SEVERITY_LABEL[alert.severity]}
                  </span>
                  <span>{adminSiemRuleLevel(alert.rule_level)}</span>
                  <time dateTime={alert.occurred_at}>
                    {formatTime(alert.occurred_at)}
                  </time>
                </div>
                <p>{alert.description}</p>
                <p className="finding-card-source">
                  {ADMIN_SIEM_AGENT_LABEL}: <span>{alert.agent.name}</span>
                  {alert.src_ip !== null && (
                    <>
                      {" · "}
                      {ADMIN_SIEM_SRC_LABEL}: <span>{alert.src_ip}</span>
                    </>
                  )}
                  {alert.dest_ip !== null && (
                    <>
                      {" · "}
                      {ADMIN_SIEM_DEST_LABEL}: <span>{alert.dest_ip}</span>
                    </>
                  )}
                </p>
                {alert.signature !== null && (
                  <p className="finding-card-source">
                    {ADMIN_SIEM_SIGNATURE_LABEL}: <span>{alert.signature}</span>
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
