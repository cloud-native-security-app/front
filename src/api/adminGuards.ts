/**
 * Runtime guards for the admin feed payloads (see `./types.ts`). A payload
 * that does not match is dropped, never rendered. They check the fields the
 * UI reads; extra fields are ignored (the UI never renders more than it
 * types).
 */

import type {
  AdminCriticalFinding,
  AdminDelta,
  AdminEventEntry,
  AdminInFlightScan,
  AdminKpis,
  AdminScanChange,
  AdminSeries,
  AdminSeriesBucket,
  AdminSiemAlert,
  AdminSiemSeverity,
  AdminSiemSeverityCounts,
  AdminSnapshot,
  AdminStreamClosed,
} from "./types";

type Rec = Record<string, unknown>;

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStr(value: unknown): value is string {
  return typeof value === "string";
}

function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullable<T>(
  value: unknown,
  check: (v: unknown) => v is T,
): value is T | null {
  return value === null || check(value);
}

function isArrayOf<T>(
  value: unknown,
  check: (v: unknown) => v is T,
): value is T[] {
  return Array.isArray(value) && value.every(check);
}

export function isAdminKpis(value: unknown): value is AdminKpis {
  return (
    isRec(value) &&
    isNum(value["scans_in_flight"]) &&
    isNum(value["completed_last_window"]) &&
    isNum(value["failed_last_window"]) &&
    isNullable(value["failure_rate"], isNum) &&
    isNum(value["active_users"]) &&
    isNum(value["rate_limit_hits"]) &&
    isNum(value["malformed_records"])
  );
}

function isInFlightScan(value: unknown): value is AdminInFlightScan {
  return (
    isRec(value) &&
    isStr(value["scan_id"]) &&
    (value["status"] === "requested" || value["status"] === "running") &&
    isStr(value["since"])
  );
}

function isCriticalFinding(value: unknown): value is AdminCriticalFinding {
  return (
    isRec(value) &&
    isStr(value["event_id"]) &&
    isStr(value["occurred_at"]) &&
    isStr(value["scan_id"]) &&
    isNullable(value["port"] ?? null, isNum) &&
    isNullable(value["protocol"] ?? null, isStr) &&
    isNullable(value["cve_id"] ?? null, isStr) &&
    isStr(value["severity"]) &&
    isStr(value["confidence"])
  );
}

function isEventEntry(value: unknown): value is AdminEventEntry {
  return (
    isRec(value) &&
    isStr(value["event_id"]) &&
    isStr(value["event_type"]) &&
    isStr(value["occurred_at"]) &&
    isStr(value["source"]) &&
    (value["actor_sub"] === undefined || isStr(value["actor_sub"])) &&
    (value["scan_id"] === undefined || isStr(value["scan_id"]))
  );
}

function isScanChange(value: unknown): value is AdminScanChange {
  return (
    isRec(value) &&
    isStr(value["scan_id"]) &&
    (value["status"] === "requested" ||
      value["status"] === "running" ||
      value["status"] === "finished")
  );
}

function isCountMap(value: unknown): boolean {
  return isRec(value) && Object.values(value).every((n) => isNum(n) && n >= 0);
}

function isSeriesBucket(value: unknown): value is AdminSeriesBucket {
  return (
    isRec(value) &&
    isStr(value["minute"]) &&
    isCountMap(value["by_type"]) &&
    isCountMap(value["findings_by_severity"])
  );
}

function isSeries(value: unknown): value is AdminSeries {
  return (
    isRec(value) &&
    isNum(value["bucket_seconds"]) &&
    value["bucket_seconds"] > 0 &&
    isArrayOf(value["buckets"], isSeriesBucket)
  );
}

export function isAdminSnapshot(value: unknown): value is AdminSnapshot {
  return (
    isRec(value) &&
    isNum(value["seq"]) &&
    isStr(value["generated_at"]) &&
    isNum(value["window_seconds"]) &&
    isAdminKpis(value["kpis"]) &&
    isArrayOf(value["scans_in_flight"], isInFlightScan) &&
    isArrayOf(value["critical_findings"], isCriticalFinding) &&
    isArrayOf(value["recent_events"], isEventEntry) &&
    // Older backends send no series: accepted, the charts show an empty state.
    (value["series"] === undefined ||
      value["series"] === null ||
      isSeries(value["series"]))
  );
}

export function isAdminDelta(value: unknown): value is AdminDelta {
  return (
    isRec(value) &&
    isNum(value["seq"]) &&
    isNullable(value["event"] ?? null, isEventEntry) &&
    isAdminKpis(value["kpis"]) &&
    isNullable(value["scan_change"] ?? null, isScanChange) &&
    isNullable(value["critical_finding"] ?? null, isCriticalFinding)
  );
}

export function isAdminStreamClosed(
  value: unknown,
): value is AdminStreamClosed {
  return isRec(value) && isStr(value["reason"]);
}

const SIEM_SEVERITIES: readonly AdminSiemSeverity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

function isSiemSeverity(value: unknown): value is AdminSiemSeverity {
  return SIEM_SEVERITIES.some((severity) => severity === value);
}

function isSiemAlert(value: unknown): value is AdminSiemAlert {
  return (
    isRec(value) &&
    isStr(value["event_id"]) &&
    isStr(value["occurred_at"]) &&
    isSiemSeverity(value["severity"]) &&
    isStr(value["rule_id"]) &&
    isNum(value["rule_level"]) &&
    value["rule_level"] >= 0 &&
    value["rule_level"] <= 16 &&
    isStr(value["description"]) &&
    isRec(value["agent"]) &&
    isStr(value["agent"]["id"]) &&
    isStr(value["agent"]["name"]) &&
    isNullable(value["src_ip"], isStr) &&
    isNullable(value["dest_ip"], isStr) &&
    isNullable(value["signature"], isStr)
  );
}

/** A tolerant read: an absent or malformed alert is `null`, never an error. */
function readSiemAlert(value: unknown): AdminSiemAlert | null {
  return isSiemAlert(value) ? value : null;
}

function readSiemKpis(kpis: AdminKpis): AdminKpis {
  // Untyped read: an older backend sends none of these fields.
  const raw: Rec = { ...kpis };
  const counts = isRec(raw["siem_alerts_by_severity"])
    ? raw["siem_alerts_by_severity"]
    : {};
  const byCount = (key: AdminSiemSeverity): number => {
    const n = counts[key];
    return isNum(n) && n >= 0 ? n : 0;
  };
  const siem_alerts_by_severity: AdminSiemSeverityCounts = {
    low: byCount("low"),
    medium: byCount("medium"),
    high: byCount("high"),
    critical: byCount("critical"),
  };
  const total = raw["siem_alerts"];
  return {
    ...kpis,
    siem_alerts: isNum(total) && total >= 0 ? total : 0,
    siem_alerts_by_severity,
  };
}

/**
 * Validates a snapshot and fills in the SIEM fields: an older backend (or
 * one with SIEM off) yields `siem_enabled=false`, no alerts and zero counts;
 * a malformed alert (unknown severity included) is dropped, not fatal.
 * `undefined` when the base shape is invalid.
 */
export function normalizeAdminSnapshot(
  value: unknown,
): AdminSnapshot | undefined {
  if (!isAdminSnapshot(value)) {
    return undefined;
  }
  const raw: Rec = { ...value };
  const alerts = Array.isArray(raw["siem_alerts"]) ? raw["siem_alerts"] : [];
  return {
    ...value,
    kpis: readSiemKpis(value.kpis),
    siem_enabled: raw["siem_enabled"] === true,
    siem_alerts: alerts.filter(isSiemAlert),
  };
}

/** Delta counterpart of `normalizeAdminSnapshot` (`siem_alert` or `null`). */
export function normalizeAdminDelta(value: unknown): AdminDelta | undefined {
  if (!isAdminDelta(value)) {
    return undefined;
  }
  const raw: Rec = { ...value };
  return {
    ...value,
    kpis: readSiemKpis(value.kpis),
    siem_alert: readSiemAlert(raw["siem_alert"]),
  };
}
