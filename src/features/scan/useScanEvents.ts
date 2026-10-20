/**
 * Estado en tiempo real de un escaneo (RF-07/RF-08) vía `subscribeToScanEvents`
 * de `src/api` (ver docs/architecture.md, capa 3: "estado en tiempo real del
 * escaneo recién creado"). Traduce el vocabulario del stream SSE
 * (`started|completed|failed`) al vocabulario del histórico REST
 * (`PENDIENTE|EN_PROGRESO|COMPLETADO|FALLIDO`, ver `src/api/types.ts`) con el
 * mismo mapeo que aplica `applyEventToRecord` del lado del servidor de
 * contrato (`e2e/contract-server/store.ts`): antes de que llegue cualquier
 * evento, el estado es `PENDIENTE` (el escaneo ya fue encolado por
 * `submitScan`, pero SSE aún no emitió nada).
 */

import { useEffect, useState } from "react";

import {
  subscribeToScanEvents,
  type ConnectionStatus,
  type ScanOutcomeEvent,
  type ScanStatus,
} from "../../api";

export interface ScanEventsState {
  /** Estado más reciente del escaneo, en el vocabulario del histórico REST. */
  status: ScanStatus;
  /**
   * Estado de la conexión SSE, para que la UI pueda distinguir
   * "reconectando" (corte de red real, `EventSource` reintentando solo) de
   * "sin cambios" (conexión abierta, sin eventos nuevos todavía).
   */
  connectionStatus: ConnectionStatus;
}

/** Traduce un evento del stream SSE a su estado equivalente del histórico REST. */
export function scanOutcomeEventToStatus(event: ScanOutcomeEvent): ScanStatus {
  switch (event.status) {
    case "started":
      return "EN_PROGRESO";
    case "completed":
      return "COMPLETADO";
    case "failed":
      return "FALLIDO";
  }
}

function initialState(): ScanEventsState {
  return { status: "PENDIENTE", connectionStatus: "connecting" };
}

/**
 * Se suscribe a los eventos de `scanId` mientras el componente que llama a
 * este hook está montado. Si `scanId` es `undefined` (todavía no se encoló
 * ningún escaneo), no se suscribe a nada y expone el estado inicial. Cierra
 * la suscripción en el cleanup del `useEffect` (sin fugas de `EventSource`
 * abiertos) y también al cambiar de `scanId`.
 */
export function useScanEvents(scanId: string | undefined): ScanEventsState {
  // Reinicia el estado durante el render (no dentro del efecto: llamar a
  // `setState` de forma incondicional en el cuerpo de un efecto dispara
  // renders en cascada, ver regla `react-hooks/set-state-in-effect`) cuando
  // `scanId` cambia — patrón oficial de React para "ajustar estado cuando
  // cambia una prop" (https://react.dev/reference/react/useState#storing-information-from-previous-renders).
  const [trackedScanId, setTrackedScanId] = useState(scanId);
  const [state, setState] = useState<ScanEventsState>(initialState);
  if (scanId !== trackedScanId) {
    setTrackedScanId(scanId);
    setState(initialState());
  }

  useEffect(() => {
    if (!scanId) {
      return;
    }
    const subscription = subscribeToScanEvents(
      scanId,
      (event) => {
        setState((previous) => ({
          ...previous,
          status: scanOutcomeEventToStatus(event),
        }));
      },
      (connectionStatus) => {
        setState((previous) => ({ ...previous, connectionStatus }));
      },
    );
    return () => {
      subscription.close();
    };
  }, [scanId]);

  return state;
}
