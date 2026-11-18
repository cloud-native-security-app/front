/**
 * Guards de runtime para narrowing de `unknown` (ver docs/conventions.md:
 * "preferir `unknown` + narrowing" en vez de `any`). Se usan para detectar
 * un "payload inesperado" del Gateway (200 pero cuerpo con forma distinta a
 * la documentada) y mapearlo a `ApiError { kind: "unexpected" }` en vez de
 * dejar pasar un valor mal formado a la UI.
 */

import type {
  MeResponse,
  NetworkCredential,
  NetworkScanRejectionReason,
  Role,
  ScanHistoryEntry,
  ScanMode,
  ScanOutcomeEvent,
  ScanPort,
  ScanResult,
  ScanStatus,
  ScanVulnerability,
  SubmitScanResponse,
  VulnerabilitySeverity,
  VulnerabilitySource,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

const SCAN_STATUSES: readonly ScanStatus[] = [
  "PENDIENTE",
  "EN_PROGRESO",
  "COMPLETADO",
  "FALLIDO",
  "CANCELADO",
];

export function isScanStatus(value: unknown): value is ScanStatus {
  return (
    isString(value) && (SCAN_STATUSES as readonly string[]).includes(value)
  );
}

const SCAN_MODES: readonly ScanMode[] = ["ssh", "network"];

export function isScanMode(value: unknown): value is ScanMode {
  return isString(value) && (SCAN_MODES as readonly string[]).includes(value);
}

const NETWORK_SCAN_REJECTION_REASONS: readonly NetworkScanRejectionReason[] = [
  "target_loopback",
  "target_link_local",
  "target_unique_local",
  "target_multicast",
  "target_broadcast",
  "target_unspecified",
  "target_outside_allowed_ranges",
  "target_unresolvable",
  "target_resolves_to_denied",
];

export function isNetworkScanRejectionReason(
  value: unknown,
): value is NetworkScanRejectionReason {
  return (
    isString(value) &&
    (NETWORK_SCAN_REJECTION_REASONS as readonly string[]).includes(value)
  );
}

/** Fail-closed: only a literal `true` shows the IP-only mode. */
export function parseCanNetworkScan(value: unknown): boolean {
  return value === true;
}

/**
 * Fail-closed role parsing: only the exact string `"admin"` grants admin; a
 * missing (older Gateway) or unknown value is `"user"`, never an error.
 */
export function parseRole(value: unknown): Role {
  return value === "admin" ? "admin" : "user";
}

/** Shape check of `/api/me`; `role` is optional on the wire (see `parseRole`). */
export function isMeResponse(value: unknown): value is Omit<
  MeResponse,
  "role" | "can_network_scan"
> & {
  role?: unknown;
  can_network_scan?: boolean;
} {
  return (
    isRecord(value) &&
    isString(value["sub"]) &&
    isString(value["email"]) &&
    isString(value["name"]) &&
    (value["can_network_scan"] === undefined ||
      typeof value["can_network_scan"] === "boolean")
  );
}

export function isSubmitScanResponse(
  value: unknown,
): value is SubmitScanResponse {
  return isRecord(value) && isString(value["scanId"]);
}

export function isScanHistoryEntry(value: unknown): value is ScanHistoryEntry {
  return (
    isRecord(value) &&
    (value["scanId"] === undefined || isString(value["scanId"])) &&
    isString(value["target"]) &&
    isScanStatus(value["status"]) &&
    isString(value["requested_at"]) &&
    isString(value["updated_at"]) &&
    (value["failure_reason"] === null || isString(value["failure_reason"])) &&
    (value["mode"] === undefined || isScanMode(value["mode"]))
  );
}

export function isScanHistoryEntryArray(
  value: unknown,
): value is ScanHistoryEntry[] {
  return Array.isArray(value) && value.every(isScanHistoryEntry);
}

export function isNetworkCredential(
  value: unknown,
): value is NetworkCredential {
  return (
    isRecord(value) &&
    isString(value["id"]) &&
    isString(value["user_id"]) &&
    isString(value["target_pattern"]) &&
    isString(value["network_user"]) &&
    typeof value["has_sudo"] === "boolean" &&
    isString(value["created_at"]) &&
    isString(value["updated_at"])
  );
}

export function isNetworkCredentialArray(
  value: unknown,
): value is NetworkCredential[] {
  return Array.isArray(value) && value.every(isNetworkCredential);
}

const VULNERABILITY_SEVERITIES: readonly VulnerabilitySeverity[] = [
  "unknown",
  "info",
  "low",
  "medium",
  "high",
  "critical",
];

const VULNERABILITY_SOURCES: readonly VulnerabilitySource[] = [
  "nmap_nse",
  "exploit_db",
  "nvd",
];

function isScanPort(value: unknown): value is ScanPort {
  return (
    isRecord(value) &&
    typeof value["port"] === "number" &&
    isString(value["protocol"]) &&
    isString(value["state"]) &&
    (value["service"] === null || isString(value["service"])) &&
    (value["version"] === null || isString(value["version"])) &&
    isStringArray(value["cpes"])
  );
}

function isScanVulnerability(value: unknown): value is ScanVulnerability {
  return (
    isRecord(value) &&
    (value["id"] === null || isString(value["id"])) &&
    isString(value["severity"]) &&
    (VULNERABILITY_SEVERITIES as readonly string[]).includes(
      value["severity"],
    ) &&
    isString(value["description"]) &&
    isString(value["nse_script"]) &&
    isString(value["source"]) &&
    (VULNERABILITY_SOURCES as readonly string[]).includes(value["source"]) &&
    isStringArray(value["references"])
  );
}

export function isScanResult(value: unknown): value is ScanResult {
  return (
    isRecord(value) &&
    isString(value["host"]) &&
    Array.isArray(value["ports"]) &&
    value["ports"].every(isScanPort) &&
    Array.isArray(value["vulnerabilities"]) &&
    value["vulnerabilities"].every(isScanVulnerability) &&
    isString(value["scanned_at"])
  );
}

export function isScanOutcomeEvent(value: unknown): value is ScanOutcomeEvent {
  if (!isRecord(value) || !isString(value["correlation_id"])) {
    return false;
  }
  switch (value["status"]) {
    case "started":
      return true;
    case "completed":
      return isScanResult(value["result"]);
    case "failed":
      return isString(value["reason"]);
    default:
      return false;
  }
}
