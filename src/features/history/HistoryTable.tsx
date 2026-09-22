/**
 * Contenedor del histórico de escaneos del usuario (RF-13) y acción de
 * cancelar un escaneo activo (RF-14), vía `getScanHistory`/`cancelScan` de
 * `src/api`. El renderizado propiamente dicho (mostrar/ocultar la acción
 * de cancelar según `status`/`scanId`) vive en `HistoryTableView`.
 *
 * Decisión de diseño (ver `docs/architecture.md`, capa 4): tras cancelar
 * con éxito, la fila se actualiza con un **refetch simple** de la lista
 * completa, en vez de integrar `useScanEvents` (feature `realtime_status`)
 * por fila. Se prefiere así porque evita abrir un `EventSource` por cada
 * fila del histórico (uno por escaneo activo, sin límite claro) y porque
 * un refetch después de una acción explícita del usuario (cancelar) ya
 * satisface el criterio de aceptación "sin recargar la página completa"
 * sin la complejidad de orquestar N suscripciones SSE en una tabla.
 *
 * `onViewReport` (RF-11, feature `report_view`, id 7) es un callback que
 * simplemente se reenvía a `HistoryTableView`: la selección de "qué
 * reporte ver" vive como estado levantado en `App.tsx`, no aquí — este
 * componente no conoce `getReport` ni `ReportView`.
 */

import { useEffect, useState } from "react";

import {
  cancelScan,
  getScanHistory,
  type ApiError,
  type ScanHistoryEntry,
} from "../../api";
import { HistoryTableView, type RowCancelState } from "./HistoryTableView";

type HistoryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; entries: ScanHistoryEntry[] };

function describeHistoryError(error: ApiError): string {
  switch (error.kind) {
    case "network":
      return "No se pudo contactar al Gateway para cargar el histórico. Verifica tu conexión e inténtalo de nuevo.";
    case "unauthorized":
      return "Tu sesión ya no es válida. Inicia sesión nuevamente.";
    case "unexpected":
      return `Ocurrió un error inesperado (código ${error.status}) al cargar el histórico.`;
    default:
      return "Ocurrió un error inesperado al cargar el histórico.";
  }
}

function describeCancelError(error: ApiError): string {
  switch (error.kind) {
    case "network":
      return "No se pudo contactar al Gateway para cancelar el escaneo. Verifica tu conexión e inténtalo de nuevo.";
    case "unauthorized":
      return "Tu sesión ya no es válida. Inicia sesión nuevamente.";
    case "not_found":
      return "El escaneo ya no existe o no pertenece a tu sesión.";
    case "conflict":
      return "El escaneo ya no se puede cancelar: probablemente ya terminó.";
    case "unexpected":
      return `Ocurrió un error inesperado (código ${error.status}) al cancelar el escaneo.`;
    default:
      return "Ocurrió un error inesperado al cancelar el escaneo.";
  }
}

function toHistoryState(
  result: Awaited<ReturnType<typeof getScanHistory>>,
): HistoryState {
  return result.ok
    ? { status: "loaded", entries: result.value }
    : { status: "error", message: describeHistoryError(result.error) };
}

export interface HistoryTableProps {
  onViewReport: (scanId: string) => void;
}

export function HistoryTable({ onViewReport }: HistoryTableProps) {
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const [rowStates, setRowStates] = useState<Record<string, RowCancelState>>(
    {},
  );

  useEffect(() => {
    // Patrón oficial de `useEffect` con una petición async (mismo que
    // `SessionProvider`, feature `auth_session`): la llamada se dispara
    // dentro del efecto y el `setState` ocurre en el `.then()`, guardado
    // por `active` para no actualizar tras el desmontaje — nunca una
    // función async marcada `async` como cuerpo directo del efecto.
    let active = true;
    void getScanHistory().then((result) => {
      if (active) {
        setState(toHistoryState(result));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleCancel(scanId: string): Promise<void> {
    setRowStates((previous) => ({
      ...previous,
      [scanId]: { status: "cancelling" },
    }));
    const result = await cancelScan(scanId);
    if (result.ok) {
      setRowStates((previous) => ({
        ...previous,
        [scanId]: { status: "idle" },
      }));
      const refreshed = await getScanHistory();
      setState(toHistoryState(refreshed));
    } else {
      setRowStates((previous) => ({
        ...previous,
        [scanId]: {
          status: "error",
          message: describeCancelError(result.error),
        },
      }));
    }
  }

  if (state.status === "loading") {
    return <p role="status">Cargando histórico…</p>;
  }

  if (state.status === "error") {
    return <p role="alert">{state.message}</p>;
  }

  return (
    <HistoryTableView
      entries={state.entries}
      rowStates={rowStates}
      onCancel={(scanId) => void handleCancel(scanId)}
      onViewReport={onViewReport}
    />
  );
}
