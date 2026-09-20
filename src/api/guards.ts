/**
 * Guards de runtime para narrowing de `unknown` (ver docs/conventions.md:
 * "preferir `unknown` + narrowing" en vez de `any`). Se usan para detectar
 * un "payload inesperado" del Gateway (200 pero cuerpo con forma distinta a
 * la documentada) y mapearlo a `ApiError { kind: "unexpected" }` en vez de
 * dejar pasar un valor mal formado a la UI.
 */

import type {
  MeResponse,
  ScanHistoryEntry,
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
];

export function isScanStatus(value: unknown): value is ScanStatus {
  return (
    isString(value) && (SCAN_STATUSES as readonly string[]).includes(value)
  );
}

export function isMeResponse(value: unknown): value is MeResponse {
  return (
    isRecord(value) &&
    isString(value["sub"]) &&
    isString(value["email"]) &&
    isString(value["name"])
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
    isString(value["updated_at"])
  );
}

export function isScanHistoryEntryArray(
  value: unknown,
): value is ScanHistoryEntry[] {
  return Array.isArray(value) && value.every(isScanHistoryEntry);
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
