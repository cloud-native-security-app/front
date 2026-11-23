/**
 * Encolado, histórico y cancelación de escaneos (RF-04/RF-13/RF-14).
 */

import {
  isNetworkScanRejectionReason,
  isScanHistoryEntryArray,
  normalizeHistoryEntry,
  isSubmitScanResponse,
} from "./guards";
import { mapCommonErrorStatus, parseJson, performRequest } from "./httpClient";
import type {
  ApiError,
  ApiResult,
  ScanHistoryEntry,
  ScanMode,
  SubmitScanResponse,
} from "./types";

function errorCodeOf(bodyText: string): {
  error: unknown;
  reason: unknown;
} {
  const parsed = parseJson(bodyText);
  if (!parsed.ok || typeof parsed.value !== "object" || parsed.value === null) {
    return { error: undefined, reason: undefined };
  }
  const body = parsed.value as Record<string, unknown>;
  return { error: body["error"], reason: body["reason"] };
}

/**
 * The network-mode bodies are JSON with an `error` code. A 403 carrying one
 * is a missing permission, not an expired session, so it must not reach
 * `mapCommonErrorStatus` (which signals "unauthorized" and ends the session).
 */
function mapNetworkScanError(
  status: number,
  bodyText: string,
): ApiError | undefined {
  if (status !== 403 && status !== 503 && status !== 422) {
    return undefined;
  }
  const { error, reason } = errorCodeOf(bodyText);
  if (status === 403 && error === "network_scan_not_permitted") {
    return { kind: "network_scan_not_permitted" };
  }
  if (status === 503 && error === "network_scan_permission_unavailable") {
    return { kind: "network_scan_unavailable" };
  }
  if (status === 422 && error === "network_scan_target_rejected") {
    return {
      kind: "network_scan_target_rejected",
      reason: isNetworkScanRejectionReason(reason) ? reason : "unknown",
    };
  }
  return undefined;
}

/**
 * Encola un nuevo escaneo sobre `target` (RF-04). La validación de formato
 * de IP/rango en el cliente (RF-02/RF-03) vive en `src/features/scan`, no
 * aquí — este módulo solo tipa la respuesta y los errores del Gateway.
 *
 * `mode` is sent only for `"network"` (IP only); an `ssh` request keeps the
 * original `{ target }` body, so the Gateway default applies.
 *
 * Puede fallar con: `network`, `unauthorized`, `validation` (400, target
 * inválido según el Gateway), `network_scan_not_permitted` (403 with its
 * own JSON body, not a session failure), `network_scan_unavailable` (503),
 * `network_scan_target_rejected` (422 with its JSON body), `unexpected`
 * (429/422/501/502/504 u otro payload que no matchea `SubmitScanResponse`).
 */
export async function submitScan(
  target: string,
  mode: ScanMode = "ssh",
): Promise<ApiResult<SubmitScanResponse>> {
  const result = await performRequest("/api/scans", {
    method: "POST",
    jsonBody: mode === "network" ? { target, mode } : { target },
  });
  if ("networkError" in result) {
    return { ok: false, error: { kind: "network" } };
  }
  if (result.status !== 200) {
    return {
      ok: false,
      error:
        mapNetworkScanError(result.status, result.bodyText) ??
        mapCommonErrorStatus(result.status, result.bodyText),
    };
  }
  const parsed = parseJson(result.bodyText);
  if (!parsed.ok || !isSubmitScanResponse(parsed.value)) {
    return { ok: false, error: { kind: "unexpected", status: result.status } };
  }
  return { ok: true, value: parsed.value };
}

/**
 * Histórico de escaneos del usuario (RF-13).
 *
 * Puede fallar con: `network`, `unauthorized`, `unexpected`.
 */
export async function getScanHistory(): Promise<ApiResult<ScanHistoryEntry[]>> {
  const result = await performRequest("/api/scans");
  if ("networkError" in result) {
    return { ok: false, error: { kind: "network" } };
  }
  if (result.status !== 200) {
    return {
      ok: false,
      error: mapCommonErrorStatus(result.status, result.bodyText),
    };
  }
  const parsed = parseJson(result.bodyText);
  if (!parsed.ok || !isScanHistoryEntryArray(parsed.value)) {
    return { ok: false, error: { kind: "unexpected", status: result.status } };
  }
  return { ok: true, value: parsed.value.map(normalizeHistoryEntry) };
}

/**
 * Cancela un escaneo en `PENDIENTE`/`EN_PROGRESO` (RF-14).
 *
 * Puede fallar con: `network`, `unauthorized`, `not_found` (scanId ajeno o
 * inexistente — mismo status para ambos casos, deliberado, ver
 * `docs/decisions.md`), `conflict` (409, el escaneo ya
 * está en un estado terminal: `COMPLETADO`, `FALLIDO` o `CANCELADO`), `unexpected`.
 */
export async function cancelScan(scanId: string): Promise<ApiResult<void>> {
  const result = await performRequest(
    `/api/scans/${encodeURIComponent(scanId)}/cancel`,
    { method: "POST" },
  );
  if ("networkError" in result) {
    return { ok: false, error: { kind: "network" } };
  }
  if (result.status === 202) {
    return { ok: true, value: undefined };
  }
  if (result.status === 409) {
    return {
      ok: false,
      error: { kind: "conflict", message: result.bodyText },
    };
  }
  return {
    ok: false,
    error: mapCommonErrorStatus(result.status, result.bodyText),
  };
}
