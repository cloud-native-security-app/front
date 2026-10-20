/**
 * Contenedor de la vista de reporte consolidado de un escaneo (RF-11,
 * feature `report_view`): llama a `getReport(scanId)` de `src/api` y
 * traduce el resultado a los estados que exige el criterio de aceptación
 * 2 — un scan que existe pero no está `COMPLETADO` (`ApiError.kind ===
 * "not_ready"`) es un estado vacío/explicativo, nunca un error genérico
 * (`not_found`/`network`/`unexpected` sí lo son). El renderizado
 * estructurado del reporte vive en `ReportDetails` (componente puro, sin
 * conocimiento de `src/api`, ver su comentario de cabecera).
 *
 * Se vuelve a pedir el reporte cada vez que cambia `scanId` (efecto con
 * `scanId` en las dependencias). El estado se reinicia a `loading`
 * **durante el render** (no dentro del efecto: llamar a `setState` de
 * forma incondicional en el cuerpo de un efecto dispara renders en
 * cascada, ver regla `react-hooks/set-state-in-effect`) — mismo patrón ya
 * establecido por `useScanEvents` (feature `realtime_status`) para
 * "ajustar estado cuando cambia una prop".
 */

import { useEffect, useState } from "react";

import { getReport, type ApiError, type ScanResult } from "../../api";
import { buildReportExport } from "./buildReportExport";
import { downloadTextFile } from "./downloadTextFile";
import { ReportDetails } from "./ReportDetails";

type ReportState =
  | { status: "loading" }
  | { status: "not_ready" }
  | { status: "error"; message: string }
  | { status: "loaded"; report: ScanResult };

function describeReportError(error: ApiError): string {
  switch (error.kind) {
    case "network":
      return "No se pudo contactar al Gateway para obtener el reporte. Verifica tu conexión e inténtalo de nuevo.";
    case "unauthorized":
      return "Tu sesión ya no es válida. Inicia sesión nuevamente.";
    case "not_found":
      return "El reporte no existe o no pertenece a tu sesión.";
    case "unexpected":
      return `Ocurrió un error inesperado (código ${error.status}) al obtener el reporte.`;
    default:
      return "Ocurrió un error inesperado al obtener el reporte.";
  }
}

function toReportState(
  result: Awaited<ReturnType<typeof getReport>>,
): ReportState {
  if (result.ok) {
    return { status: "loaded", report: result.value };
  }
  if (result.error.kind === "not_ready") {
    return { status: "not_ready" };
  }
  return { status: "error", message: describeReportError(result.error) };
}

export interface ReportViewProps {
  scanId: string;
}

export function ReportView({ scanId }: ReportViewProps) {
  const [trackedScanId, setTrackedScanId] = useState(scanId);
  const [state, setState] = useState<ReportState>({ status: "loading" });
  if (scanId !== trackedScanId) {
    setTrackedScanId(scanId);
    setState({ status: "loading" });
  }

  useEffect(() => {
    let active = true;
    // Patrón oficial de `useEffect` con una petición async (mismo que
    // `HistoryTable`/`SessionProvider`): la llamada se dispara dentro del
    // efecto y el `setState` ocurre en el `.then()`, guardado por `active`
    // para no actualizar tras el desmontaje o un cambio de `scanId`.
    void getReport(scanId).then((result) => {
      if (active) {
        setState(toReportState(result));
      }
    });
    return () => {
      active = false;
    };
  }, [scanId]);

  if (state.status === "loading") {
    return <p role="status">Cargando reporte…</p>;
  }

  if (state.status === "not_ready") {
    return (
      <p role="status">
        El escaneo todavía no ha terminado. El reporte estará disponible cuando
        su estado sea COMPLETADO.
      </p>
    );
  }

  if (state.status === "error") {
    return <p role="alert">{state.message}</p>;
  }

  return (
    <ReportDetails
      scanId={scanId}
      report={state.report}
      onExport={() => downloadTextFile(buildReportExport(scanId, state.report))}
    />
  );
}
