/**
 * Sesión/perfil del Gateway (RF-01). `front` nunca decodifica ni gestiona
 * el token OAuth de Google — el login es una redirección de navegador
 * completa (ver docs/security-scope.md), nunca un `fetch`.
 */

import { gatewayBaseUrl } from "./config";
import { isMeResponse } from "./guards";
import { mapCommonErrorStatus, parseJson, performRequest } from "./httpClient";
import type { ApiResult, MeResponse } from "./types";

/**
 * URL a la que el navegador debe navegar (asignación completa de
 * `window.location`, nunca un `fetch`) para iniciar el login delegado en
 * el Gateway (RF-01). El Gateway hace el handshake OIDC con Google y, al
 * volver, establece la sesión vía cookie `HttpOnly` — `front` nunca ve el
 * token (ver docs/security-scope.md).
 */
export function loginRedirectUrl(): string {
  return `${gatewayBaseUrl()}/auth/login`;
}

/**
 * Consulta si hay una sesión activa. Es la ÚNICA fuente de verdad sobre
 * "hay sesión" (ver docs/security-scope.md) — nunca se infiere de la
 * presencia de una cookie, que además `front` no puede leer.
 *
 * Puede fallar con `ApiError`: `network` (Gateway inalcanzable),
 * `unauthorized` (401, sin sesión válida/expirada), `unexpected` (otro
 * status o un payload que no matchea `MeResponse`).
 */
export async function getMe(): Promise<ApiResult<MeResponse>> {
  const result = await performRequest("/api/me");
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
  if (!parsed.ok || !isMeResponse(parsed.value)) {
    return { ok: false, error: { kind: "unexpected", status: result.status } };
  }
  return { ok: true, value: parsed.value };
}
