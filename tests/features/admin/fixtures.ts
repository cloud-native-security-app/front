/** Builders of gateway admin payloads (wire shapes of `src/api/types.ts`). */
import type {
  AdminSeries,
  AdminSeriesBucket,
  AdminCriticalFinding,
  AdminDelta,
  AdminEventEntry,
  AdminKpis,
  AdminSiemAlert,
  AdminSnapshot,
} from "../../../src/api";

export function makeKpis(overrides: Partial<AdminKpis> = {}): AdminKpis {
  return {
    scans_in_flight: 0,
    completed_last_window: 0,
    failed_last_window: 0,
    failure_rate: null,
    active_users: 0,
    rate_limit_hits: 0,
    malformed_records: 0,
    siem_alerts: 0,
    siem_alerts_by_severity: { low: 0, medium: 0, high: 0, critical: 0 },
    ...overrides,
  };
}

export function makeEvent(
  id: string,
  overrides: Partial<AdminEventEntry> = {},
): AdminEventEntry {
  return {
    event_id: id,
    event_type: "scan.completed",
    occurred_at: "2026-11-11T10:00:00Z",
    source: "nmap-service",
    scan_id: `scan-${id}`,
    payload: {},
    ...overrides,
  };
}

export function makeFinding(
  id: string,
  overrides: Partial<AdminCriticalFinding> = {},
): AdminCriticalFinding {
  return {
    event_id: id,
    occurred_at: "2026-11-11T10:00:00Z",
    scan_id: `scan-${id}`,
    port: 22,
    protocol: "tcp",
    cve_id: "CVE-2024-6387",
    severity: "critical",
    confidence: "confirmed",
    ...overrides,
  };
}

export function makeSiemAlert(
  id: string,
  overrides: Partial<AdminSiemAlert> = {},
): AdminSiemAlert {
  return {
    event_id: id,
    occurred_at: "2026-11-11T10:00:00Z",
    severity: "high",
    rule_id: "5712",
    rule_level: 10,
    description: `Regla ${id}`,
    agent: { id: "001", name: "web-01" },
    src_ip: "10.0.0.5",
    dest_ip: "10.0.0.9",
    signature: null,
    ...overrides,
  };
}

export function makeSnapshot(
  overrides: Partial<AdminSnapshot> = {},
): AdminSnapshot {
  return {
    seq: 1,
    generated_at: "2026-11-11T10:00:00Z",
    window_seconds: 900,
    kpis: makeKpis(),
    scans_in_flight: [],
    critical_findings: [],
    recent_events: [],
    siem_enabled: false,
    siem_alerts: [],
    ...overrides,
  };
}

export function makeDelta(overrides: Partial<AdminDelta> = {}): AdminDelta {
  return {
    seq: 2,
    event: null,
    kpis: makeKpis(),
    scan_change: null,
    critical_finding: null,
    siem_alert: null,
    ...overrides,
  };
}

export function makeBucket(
  minute: string,
  overrides: Partial<AdminSeriesBucket> = {},
): AdminSeriesBucket {
  return { minute, by_type: {}, findings_by_severity: {}, ...overrides };
}

/** 15 buckets ending at 23:15Z; `overrides` maps bucket index to its content. */
export function makeSeries(
  overrides: Record<number, Partial<AdminSeriesBucket>> = {},
): AdminSeries {
  return {
    bucket_seconds: 60,
    buckets: Array.from({ length: 15 }, (_, i) =>
      makeBucket(
        `2026-11-11T23:${String(i + 1).padStart(2, "0")}:00Z`,
        overrides[i],
      ),
    ),
  };
}
