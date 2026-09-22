/**
 * Encolado, histórico y cancelación de escaneos (RF-04/RF-13/RF-14).
 */

import { isScanHistoryEntryArray, isSubmitScanResponse } from "./guards";
import { mapCommonErrorStatus, parseJson, performRequest } from "./httpClient";
import type { ApiResult, ScanHistoryEntry, SubmitScanResponse } from "./types";

/**
 * Encola un nuevo escaneo sobre `target` (RF-04). La validación de formato
 * de IP/rango en el cliente (RF-02/RF-03) vive en `src/features/scan`, no
 * aquí — este módulo solo tipa la respuesta y los errores del Gateway.
 *
 * Puede fallar con: `network`, `unauthorized`, `validation` (400, target
 * inválido según el Gateway), `unexpected` (429/422/501/502/504 u otro
 * payload que no matchea `SubmitScanResponse`).
 */
export async function submitScan(
  target: string,
): Promise<ApiResult<SubmitScanResponse>> {
  const result = await performRequest("/api/scans", {
    method: "POST",
    jsonBody: { target },
  });
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
  return { ok: true, value: parsed.value };
}

/**
 * Cancela un escaneo en `PENDIENTE`/`EN_PROGRESO` (RF-14).
 *
 * Puede fallar con: `network`, `unauthorized`, `not_found` (scanId ajeno o
 * inexistente — mismo status para ambos casos, deliberado, ver
 * `progress/explore_gateway_contract.md`), `conflict` (409, el escaneo ya
 * está en un estado terminal), `unexpected`.
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
