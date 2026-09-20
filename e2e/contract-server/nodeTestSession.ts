/**
 * Polyfills exclusivos de entorno de test (Vitest bajo jsdom, y specs de
 * Playwright que corren en Node, no en un navegador real) para poder
 * ejercer `src/api` contra el servidor de contrato tal como lo haría un
 * navegador real. Nunca se importa desde `src/` — solo desde
 * `tests/setup.ts` y specs de `e2e/`.
 *
 * Dos gotchas verificados en este entorno (ver
 * `progress/explore_sse_contract_server.md` §3.3 y hallazgos propios de la
 * feature `api_client`):
 *
 * 1. Ni jsdom ni el `fetch`/`EventSource` nativos de Node implementan
 *    `EventSource` — se usa el polyfill de la librería `undici` (ya
 *    presente como dependencia transitiva del stack de build/test; se
 *    añade explícita a `devDependencies` para no depender de una
 *    dependencia fantasma — ver `progress/impl_api_client.md`).
 * 2. El `fetch` nativo de Node (y el `EventSource` de `undici`) **no**
 *    mantienen un cookie jar entre llamadas — incluso con
 *    `credentials: "include"`, un `Set-Cookie` de una respuesta nunca se
 *    reenvía automáticamente en la siguiente petición (confirmado
 *    ejecutando un servidor `node:http` de prueba en este entorno: sin
 *    este polyfill, la segunda petición llega sin cookie). Un navegador
 *    real sí lo hace — por eso `src/api` nunca gestiona cookies
 *    manualmente (ver docs/security-scope.md). Este polyfill sustituye
 *    ese comportamiento del navegador SOLO en el proceso de test, para
 *    poder probar los flujos autenticados de `src/api` tal cual los usa un
 *    navegador, sin tocar el código de producción.
 */

import {
  Agent,
  EventSource,
  fetch as undiciFetch,
  setGlobalDispatcher,
  type Dispatcher,
} from "undici";

let installed = false;
let installedCookieJar: Map<string, string> | undefined;

function isPlainHeaderRecord(
  headers: Dispatcher.DispatchOptions["headers"],
): headers is Record<string, string> {
  return (
    typeof headers === "object" && headers !== null && !Array.isArray(headers)
  );
}

function createCookieJarInterceptor(
  cookieJar: Map<string, string>,
): Dispatcher.DispatchInterceptor {
  return (dispatch) => (opts, handler) => {
    const origin = String(opts.origin);
    const storedCookie = cookieJar.get(origin);
    const nextOpts: Dispatcher.DispatchOptions = storedCookie
      ? {
          ...opts,
          headers: {
            ...(isPlainHeaderRecord(opts.headers) ? opts.headers : {}),
            cookie: storedCookie,
          },
        }
      : opts;

    // No se reemplaza `handler` por un objeto nuevo (p. ej. `{ ...handler,
    // onResponseStart: ... }`): en algunas versiones de `undici` el handler
    // que entrega `dispatch` es una instancia de clase con estado/métodos en
    // el prototipo, y un spread solo copia sus propiedades propias — eso
    // rompe el contrato interno del dispatcher y deja la petición colgada
    // para siempre (confirmado en este entorno: una petición a un servidor
    // real nunca resuelve si se sustituye el handler en vez de mutarlo).
    // Mutar `onResponseStart` in-place preserva el resto del handler intacto.
    const originalOnResponseStart = handler.onResponseStart?.bind(handler);
    handler.onResponseStart = (
      controller,
      statusCode,
      responseHeaders,
      statusMessage,
    ) => {
      const setCookie = responseHeaders["set-cookie"];
      if (setCookie) {
        const value = Array.isArray(setCookie) ? setCookie[0] : setCookie;
        if (value) {
          cookieJar.set(origin, value.split(";")[0] ?? "");
        }
      }
      originalOnResponseStart?.(
        controller,
        statusCode,
        responseHeaders,
        statusMessage,
      );
    };
    return dispatch(nextOpts, handler);
  };
}

/**
 * Instala, una sola vez por proceso, el polyfill de `EventSource` y el
 * cookie jar transparente sobre el dispatcher global de `undici` (del que
 * cuelgan tanto `fetch` como `EventSource`). Idempotente: llamar más de
 * una vez no duplica el estado.
 */
export function installNodeTestSessionSupport(): void {
  if (installed) {
    return;
  }
  installed = true;

  const cookieJar = new Map<string, string>();
  installedCookieJar = cookieJar;
  setGlobalDispatcher(
    new Agent().compose(createCookieJarInterceptor(cookieJar)),
  );

  // @ts-expect-error -- polyfill de test: Node no implementa `fetch`/`EventSource`
  // con cookie jar propio; se sustituyen por las versiones de `undici` ligadas
  // al dispatcher global que sí lo tiene. Nunca se ejecuta en producción.
  globalThis.fetch = undiciFetch;
  if (typeof globalThis.EventSource === "undefined") {
    // @ts-expect-error -- mismo motivo que arriba: jsdom no implementa EventSource.
    globalThis.EventSource = EventSource;
  }
}

/**
 * Olvida todas las cookies de sesión guardadas por el polyfill. Necesario
 * porque el cookie jar es un singleton por proceso de test: un test que
 * necesite ejercer el camino "sin sesión" (401) después de que otro test
 * del mismo archivo ya inició sesión debe limpiar el jar primero, o
 * heredaría esa cookie como si fuera un navegador que nunca cerró sesión.
 */
export function clearNodeTestSessionCookies(): void {
  installedCookieJar?.clear();
}
