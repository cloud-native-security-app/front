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

export function isAdminSnapshot(value: unknown): value is AdminSnapshot {
  return (
    isRec(value) &&
    isNum(value["seq"]) &&
    isStr(value["generated_at"]) &&
    isNum(value["window_seconds"]) &&
    isAdminKpis(value["kpis"]) &&
    isArrayOf(value["scans_in_flight"], isInFlightScan) &&
    isArrayOf(value["critical_findings"], isCriticalFinding) &&
    isArrayOf(value["recent_events"], isEventEntry)
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
