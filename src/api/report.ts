/**
 * Reporte consolidado de un escaneo (RF-11).
 *
 * ADVERTENCIA — contrato especulativo, NO confirmado en el Gateway real:
 * `progress/explore_gateway_contract.md` confirma que el Gateway real hoy
 * NO expone ningún endpoint de reporte — `GET /api/scans/{id}/report`
 * simplemente no existe todavía (RF-11 depende de `ms-analisis`, que ni
 * siquiera existe como repo). Se decidió (ver `progress/current.md` y
 * `progress/impl_api_client.md`) implementar aquí una PROPUESTA de
 * contrato que reutiliza literalmente el shape de `ScanResult` que el
 * Gateway ya serializa en el evento SSE `completed.result`, para poder
 * construir y testear `src/features/report` (feature futura) contra el
 * servidor de contrato local (`e2e/contract-server`, que sí lo implementa
 * para poder testear). Integrar esto contra el Gateway real requiere que
 * ese repo (fuera del alcance de `front`) implemente primero este
 * endpoint — no asumir que ya existe fuera del servidor de contrato.
 */

import { isScanResult } from "./guards";
import { mapCommonErrorStatus, parseJson, performRequest } from "./httpClient";
import type { ApiResult, ScanResult } from "./types";

/**
 * Puede fallar con: `network`, `unauthorized`, `not_found` (scanId ajeno o
 * inexistente), `not_ready` (el scan existe pero todavía no está
 * `COMPLETADO` — tipado explícitamente, sin necesidad de parsear texto,
 * ver `feature_list.json` id 2), `unexpected`.
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
