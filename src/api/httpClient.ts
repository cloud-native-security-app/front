/**
 * Helper interno de `fetch` compartido por todas las funciones de
 * `src/api`: añade la URL base y las credenciales de sesión (cookie
 * `HttpOnly`, nunca leída/gestionada por este código — ver
 * docs/security-scope.md), y separa "hubo respuesta HTTP" de "no hubo
 * respuesta" (fallo de red) para que cada función mapee status codes a su
 * propio `ApiError` sin asumir nunca `await res.json()` en el camino de
 * error — el Gateway real responde texto plano en sus errores
 * (`progress/explore_gateway_contract.md` §5), nunca un envelope JSON.
 */

import { gatewayBaseUrl } from "./config";
import type { ApiError } from "./types";
import { notifyUnauthorized } from "./unauthorized";

export interface RawResponse {
  status: number;
  bodyText: string;
}

export interface NetworkError {
  networkError: true;
}

interface PerformRequestInit {
  method?: "GET" | "POST";
  jsonBody?: unknown;
}

export async function performRequest(
  path: string,
  init: PerformRequestInit = {},
): Promise<RawResponse | NetworkError> {
  const method = init.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(`${gatewayBaseUrl()}${path}`, {
      method,
      credentials: "include",
      headers:
        init.jsonBody !== undefined
          ? { "Content-Type": "application/json" }
          : undefined,
      body:
        init.jsonBody !== undefined ? JSON.stringify(init.jsonBody) : undefined,
    });
  } catch {
    // `fetch` solo rechaza la promesa por fallos de red/DNS/CORS, nunca
    // por un status HTTP de error — ese caso se maneja abajo con el status
    // ya resuelto.
    return { networkError: true };
  }
  const bodyText = await response.text();
  return { status: response.status, bodyText };
}

/**
 * Mapeo por defecto de un status HTTP de error a `ApiError`, común a casi
 * todos los endpoints protegidos del Gateway. Cada función de `src/api`
 * puede interceptar un status particular (p. ej. 409) antes de caer aquí,
 * porque su significado varía por endpoint (no hay un envelope uniforme,
 * ver `progress/explore_gateway_contract.md` §5) — el status code es la
 * señal principal, el body de texto plano es secundario/informativo.
 *
 * Un 401/403 aquí también dispara `notifyUnauthorized()` (ver
 * `./unauthorized.ts`) — es el único punto común a todas las funciones que
 * usan este mapeo, así `src/auth` puede reaccionar a un 401/403 ocurrido en
 * cualquier llamada, no solo en `getMe()` al montar (ver
 * `feature_list.json`, feature `auth_session`).
 */
export function mapCommonErrorStatus(
  status: number,
  bodyText: string,
): ApiError {
  switch (status) {
    case 401:
    case 403:
      notifyUnauthorized();
      return { kind: "unauthorized" };
    case 404:
      return { kind: "not_found" };
    case 400:
      return { kind: "validation", message: bodyText };
    default:
      return { kind: "unexpected", status };
  }
}

export type ParsedJson = { ok: true; value: unknown } | { ok: false };

/** Nunca asume que el body es JSON válido — un payload inesperado se trata como tal, no como una excepción sin manejar. */
export function parseJson(bodyText: string): ParsedJson {
  if (bodyText.length === 0) {
    return { ok: false };
  }
  try {
    return { ok: true, value: JSON.parse(bodyText) as unknown };
  } catch {
    return { ok: false };
  }
}
