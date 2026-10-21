/**
 * Reporte consolidado de un escaneo (RF-11).
 *
 * Endpoint real del Gateway: `GET /api/scans/{scan_id}/report` (requiere la
 * cookie de sesión). Respuestas: `200` con el `ScanResult` desnudo (`host`,
 * `ports`, `vulnerabilities`, `scanned_at`), `401`, `404` (inexistente o de
 * otro usuario), `409` (texto plano: el reporte aún no está disponible) y
 * `502`/`504` (falla de `ms-usuarios`). El reporte se guarda al completarse
 * el escaneo; un escaneo `FALLIDO`/`CANCELADO` nunca tiene reporte (409).
 */

import { isScanResult } from "./guards";
import { mapCommonErrorStatus, parseJson, performRequest } from "./httpClient";
import type { ApiResult, ScanResult } from "./types";

/**
 * Puede fallar con: `network`, `unauthorized`, `not_found` (scanId ajeno o
 * inexistente), `not_ready` (409: el scan existe pero aún no hay
 * reporte; tipado explícitamente, sin parsear texto), `unavailable`
 * (502/504), `unexpected`.
 */
export async function getReport(
  scanId: string,
): Promise<ApiResult<ScanResult>> {
  const result = await performRequest(
    `/api/scans/${encodeURIComponent(scanId)}/report`,
  );
  if ("networkError" in result) {
    return { ok: false, error: { kind: "network" } };
  }
  if (result.status === 409) {
    return { ok: false, error: { kind: "not_ready" } };
  }
  if (result.status === 502 || result.status === 504) {
    return { ok: false, error: { kind: "unavailable" } };
  }
  if (result.status !== 200) {
    return {
      ok: false,
      error: mapCommonErrorStatus(result.status, result.bodyText),
    };
  }
  const parsed = parseJson(result.bodyText);
  if (!parsed.ok || !isScanResult(parsed.value)) {
    return { ok: false, error: { kind: "unexpected", status: result.status } };
  }
  return { ok: true, value: parsed.value };
}
