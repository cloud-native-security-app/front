/**
 * Canal de notificación para que `src/auth` se entere de un 401/403
 * ocurrido en cualquier llamada de `src/api` (no solo la de `getMe()` al
 * montar la app), sin romper el límite de capas de docs/architecture.md:
 * `src/api` sigue siendo el único módulo que conoce el contrato HTTP del
 * Gateway, y nunca importa nada de `src/auth` (la dependencia va en un solo
 * sentido: `src/auth` se suscribe aquí, `src/api` nunca sabe que
 * `src/auth` existe).
 *
 * `mapCommonErrorStatus` (ver `./httpClient.ts`) invoca `notifyUnauthorized`
 * cada vez que traduce un 401/403 del Gateway a
 * `ApiError { kind: "unauthorized" }` — ese es el único punto de disparo,
 * común a todas las funciones de `src/api` que usan el mapeo de errores
 * compartido (`getMe`, `submitScan`, `getScanHistory`, `cancelScan`,
 * `getReport`). `subscribeToScanEvents` (SSE) queda fuera: `EventSource` no
 * expone el status code HTTP a JavaScript, así que un 401 en ese canal ya
 * se refleja como `"closed"`/`"reconnecting"` vía `onStatusChange` (ver
 * `./scanEvents.ts`), no puede alimentar este mismo mecanismo.
 */

type UnauthorizedHandler = () => void;

let handlers: UnauthorizedHandler[] = [];

/**
 * Registra `handler` para que se invoque cada vez que cualquier función de
 * `src/api` reciba un 401/403 del Gateway. Devuelve una función para
 * desuscribirse (p. ej. al desmontar el componente que lo registró) —
 * nunca deja una suscripción huérfana tras un unmount.
 */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  handlers.push(handler);
  return () => {
    handlers = handlers.filter((registered) => registered !== handler);
  };
}

/** Uso interno de `src/api` (ver `./httpClient.ts`) — nunca se llama desde fuera de este módulo. */
export function notifyUnauthorized(): void {
  for (const handler of handlers) {
    handler();
  }
}
