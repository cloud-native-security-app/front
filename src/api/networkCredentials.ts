/**
 * Gestión de credenciales de red del usuario (feature
 * `network_credentials_manager`, id 9): sin al menos una entrada configurada
 * para el objetivo, `POST /api/scans` siempre responde 422 en el Gateway
 * real. Mismo estilo que `./scans.ts`.
 */

import { isNetworkCredential, isNetworkCredentialArray } from "./guards";
import { mapCommonErrorStatus, parseJson, performRequest } from "./httpClient";
import type {
  ApiResult,
  CreateNetworkCredentialInput,
  NetworkCredential,
} from "./types";

/**
 * Crea una credencial de red para el usuario de la sesión activa.
 * `input.ssh_credentials_ref` es una credencial SSH real: viaja tal cual en
 * el cuerpo de esta petición hacia el Gateway, pero la respuesta nunca la
 * incluye (ver docs/security-scope.md) — este módulo nunca la persiste ni la
 * vuelve a leer de ninguna respuesta.
 *
 * Puede fallar con: `network`, `unauthorized`, `validation` (400, target
 * inválido según el Gateway/ms-usuarios), `unexpected` (payload inesperado u
 * otro status).
 */
export async function createNetworkCredential(
  input: CreateNetworkCredentialInput,
): Promise<ApiResult<NetworkCredential>> {
  const result = await performRequest("/api/network-credentials", {
    method: "POST",
    jsonBody: input,
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
  if (!parsed.ok || !isNetworkCredential(parsed.value)) {
    return { ok: false, error: { kind: "unexpected", status: result.status } };
  }
  return { ok: true, value: parsed.value };
}

/**
 * Lista las credenciales de red del usuario de la sesión activa (nunca
 * incluye `ssh_credentials_ref`, ver `src/api/types.ts`).
 *
 * Puede fallar con: `network`, `unauthorized`, `unexpected`.
 */
export async function listNetworkCredentials(): Promise<
  ApiResult<NetworkCredential[]>
> {
  const result = await performRequest("/api/network-credentials");
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
  if (!parsed.ok || !isNetworkCredentialArray(parsed.value)) {
    return { ok: false, error: { kind: "unexpected", status: result.status } };
  }
  return { ok: true, value: parsed.value };
}

/**
 * Borra la credencial `id` del usuario de la sesión activa. Un `id` ajeno o
 * inexistente responde `404` (nunca `403`, mismo criterio que
 * `ms-usuarios`/`gateway`, ver `gateway/src/api.rs::delete_network_credential`).
 *
 * Puede fallar con: `network`, `unauthorized`, `not_found`, `unexpected`.
 */
export async function deleteNetworkCredential(
  id: string,
): Promise<ApiResult<void>> {
  const result = await performRequest(
    `/api/network-credentials/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
  if ("networkError" in result) {
    return { ok: false, error: { kind: "network" } };
  }
  if (result.status === 204) {
    return { ok: true, value: undefined };
  }
  return {
    ok: false,
    error: mapCommonErrorStatus(result.status, result.bodyText),
  };
}
