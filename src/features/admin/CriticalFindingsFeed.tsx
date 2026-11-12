/**
 * Critical findings, newest first. The visible list is not a live region (it
 * would re-announce everything on every update); a separate polite region
 * announces one line when a new newest finding appears, never on first render.
 */

import { useState } from "react";

import type { AdminCriticalFinding } from "../../api";
import {
  ADMIN_FINDINGS_LIVE_LABEL,
  ADMIN_FINDINGS_REGION_LABEL,
  ADMIN_FINDINGS_TITLE,
  ADMIN_NO_FINDINGS_MESSAGE,
  CONFIDENCE_CONFIRMED_LABEL,
  CONFIDENCE_VERSION_MATCH_LABEL,
  SEVERITY_LABEL,
  findingLocation,
  newCriticalFindingAnnouncement,
} from "../../copy";
import { formatTime } from "./formatters";

function severityLabel(severity: string): string {
  return severity in SEVERITY_LABEL
    ? SEVERITY_LABEL[severity as keyof typeof SEVERITY_LABEL]
    : severity;
}

function confidenceLabel(confidence: string): string {
  switch (confidence) {
    case "confirmed":
      return CONFIDENCE_CONFIRMED_LABEL;
    case "version_match":
      return CONFIDENCE_VERSION_MATCH_LABEL;
    default:
      return confidence;
  }
}

export function CriticalFindingsFeed({
  findings,
}: {
  findings: AdminCriticalFinding[];
}) {
  // Adjust state while rendering when the newest finding changes (React's
  // documented "derive state from props" pattern; avoids an effect).
  const newest = findings.at(0);
  const [seenId, setSeenId] = useState(newest?.event_id);
  const [announcement, setAnnouncement] = useState("");
  if (newest?.event_id !== seenId) {
    setSeenId(newest?.event_id);
    setAnnouncement(newest ? newCriticalFindingAnnouncement(newest) : "");
  }

  return (
    <section aria-labelledby="admin-findings-title">
      <h3 id="admin-findings-title">{ADMIN_FINDINGS_TITLE}</h3>
      <p
        role="status"
        aria-live="polite"
        aria-label={ADMIN_FINDINGS_LIVE_LABEL}
        className="visually-hidden"
      >
        {announcement}
      </p>
      {findings.length === 0 ? (
        <p>{ADMIN_NO_FINDINGS_MESSAGE}</p>
      ) : (
        <div
          className="admin-region"
          role="region"
          tabIndex={0}
          aria-label={ADMIN_FINDINGS_REGION_LABEL}
        >
          <ol className="finding-list" aria-label={ADMIN_FINDINGS_TITLE}>
            {findings.map((finding) => (
              <li
                key={finding.event_id}
                className="finding-card"
                data-severity={finding.severity}
              >
                <div className="finding-card-header">
                  <span
                    className="severity-badge"
                    data-severity={finding.severity}
                  >
                    {severityLabel(finding.severity)}
                  </span>
                  <strong>{finding.cve_id ?? "—"}</strong>
                  <span>{findingLocation(finding.port, finding.protocol)}</span>
                  <span className="finding-card-source">
                    {confidenceLabel(finding.confidence)}
                  </span>
                </div>
                <p className="finding-card-source">
                  {finding.scan_id} ·{" "}
                  <time dateTime={finding.occurred_at}>
                    {formatTime(finding.occurred_at)}
                  </time>
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
