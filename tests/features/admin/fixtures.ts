/** Builders of gateway admin payloads (wire shapes of `src/api/types.ts`). */
import type {
  AdminCriticalFinding,
  AdminDelta,
  AdminEventEntry,
  AdminKpis,
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
    ...overrides,
  };
}
