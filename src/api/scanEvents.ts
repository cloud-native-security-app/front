/**
 * Suscripción en tiempo real a los eventos de un escaneo (RF-07/RF-08) vía
 * SSE (ver docs/architecture.md: SSE, no WebSocket). Usa `EventSource`
 * nativo del navegador — nunca reimplementa la reconexión automática, que
 * ya trae el propio `EventSource`.
 */

import { gatewayBaseUrl } from "./config";
import { isScanOutcomeEvent } from "./guards";
import type { ScanOutcomeEvent } from "./types";

export type ConnectionStatus =
  "connecting" | "open" | "reconnecting" | "closed";

export interface ScanEventsSubscription {
  /** Cierra la suscripción explícitamente (p. ej. al desmontar un componente). */
  close(): void;
}

/**
 * Se suscribe al stream de eventos de `scanId`. `withCredentials: true` es
 * obligatorio, no opcional: sin él, `EventSource` no envía la cookie
 * `HttpOnly` de sesión y la conexión fallaría siempre con 401 (ver
 * docs/security-scope.md).
 *
 * El estado de conexión se expone vía `onStatusChange` porque cambia de
 * forma asíncrona varias veces durante la vida de la suscripción — un
 * hook de React puede envolverlo con `useState`/`useReducer`
 * (`useScanEvents`, feature `realtime_status`).
 *
 * La suscripción se cierra a sí misma (`status: "closed"`) tras recibir un
 * evento terminal (`completed`/`failed`): el propio `EventSource` no
 * distingue "el servidor terminó a propósito" de "se cortó la conexión" —
 * sin este cierre explícito seguiría reintentando indefinidamente contra
 * un stream que ya no tiene más eventos (ver
 * `progress/explore_gateway_contract.md` §2: "el stream se cierra tras un
 * evento terminal").
 *
 * Un mensaje que no matchea `ScanOutcomeEvent` se ignora silenciosamente
 * (nunca se llama a `onEvent` con datos sin validar). No hay un canal de
 * `ApiError` aquí porque `EventSource` no expone el status HTTP de forma
 * utilizable por JS; los fallos de autorización/red se reflejan como
 * `"reconnecting"`/`"closed"` vía `onStatusChange`.
 */
export function subscribeToScanEvents(
  scanId: string,
  onEvent: (event: ScanOutcomeEvent) => void,
  onStatusChange: (status: ConnectionStatus) => void,
): ScanEventsSubscription {
  const url = `${gatewayBaseUrl()}/api/scans/${encodeURIComponent(scanId)}/events`;
  const source = new EventSource(url, { withCredentials: true });
  let closedByUs = false;

  onStatusChange("connecting");

  source.addEventListener("open", () => {
    onStatusChange("open");
  });

  source.addEventListener("error", () => {
    if (closedByUs) {
      return;
    }
    onStatusChange(
      source.readyState === EventSource.CLOSED ? "closed" : "reconnecting",
    );
  });

  source.addEventListener("message", (messageEvent: MessageEvent<string>) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(messageEvent.data);
    } catch {
      return;
    }
    if (!isScanOutcomeEvent(parsed)) {
      return;
    }
    onEvent(parsed);
    if (parsed.status === "completed" || parsed.status === "failed") {
      closedByUs = true;
      source.close();
      onStatusChange("closed");
    }
  });

  return {
    close: () => {
      closedByUs = true;
      source.close();
      onStatusChange("closed");
    },
  };
}
