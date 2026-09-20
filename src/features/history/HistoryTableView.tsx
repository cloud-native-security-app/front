/**
 * Renderizado puro de la tabla de histórico (RF-13): recibe las entradas ya
 * cargadas y el estado de cancelación por fila como props, sin conocer
 * `src/api` — separado de `HistoryTable` (el contenedor que sí llama a
 * `getScanHistory`/`cancelScan`) para poder testear la lógica de
 * mostrar/ocultar la acción de cancelar (incluida una entrada sin
 * `scanId`, caso que el servidor de contrato real nunca produce) sin
 * mockear `src/api` ni depender de red — ver `docs/conventions.md` y
 * `docs/verification.md` (nunca `vi.mock` de `src/api` en tests de
 * componente).
 *
 * También expone la acción "Ver reporte" (RF-11, feature `report_view`,
 * id 7) para filas `COMPLETADO` con `scanId`: al hacer click, informa
 * hacia arriba (`onViewReport`) qué `scanId` se seleccionó — mismo patrón
 * de estado levantado ya usado para `onCancel`, hasta `App.tsx`, que
 * decide qué renderizar (ver `docs/architecture.md`: no se introduce
 * routing nuevo para esto).
 */

import type { ScanHistoryEntry } from "../../api";
import { isCancellableEntry } from "./isCancellableEntry";
import { isReportViewableEntry } from "./isReportViewableEntry";

export type RowCancelState =
  | { status: "idle" }
  | { status: "cancelling" }
  | { status: "error"; message: string };

export interface HistoryTableViewProps {
  entries: ScanHistoryEntry[];
  rowStates: Record<string, RowCancelState>;
  onCancel: (scanId: string) => void;
  onViewReport: (scanId: string) => void;
}

function formatRequestedAt(isoDate: string): string {
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime()) ? isoDate : parsed.toLocaleString();
}

export function HistoryTableView({
  entries,
  rowStates,
  onCancel,
  onViewReport,
}: HistoryTableViewProps) {
  if (entries.length === 0) {
    return <p role="status">Todavía no hay escaneos en tu histórico.</p>;
  }

  return (
    <table>
      <caption>Histórico de escaneos</caption>
      <thead>
        <tr>
          <th scope="col">Objetivo</th>
          <th scope="col">Estado</th>
          <th scope="col">Solicitado</th>
          <th scope="col">Acción</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const rowKey =
            entry.scanId ?? `${entry.target}-${entry.requested_at}`;
          const rowState = entry.scanId
            ? (rowStates[entry.scanId] ?? { status: "idle" as const })
            : undefined;
          const scanId = entry.scanId;

          return (
            <tr key={rowKey}>
              <td>{entry.target}</td>
              <td>{entry.status}</td>
              <td>{formatRequestedAt(entry.requested_at)}</td>
              <td>
                {isCancellableEntry(entry) && scanId && (
                  <>
                    <button
                      type="button"
                      aria-label={`Cancelar escaneo de ${entry.target}`}
                      disabled={rowState?.status === "cancelling"}
                      onClick={() => onCancel(scanId)}
                    >
                      {rowState?.status === "cancelling"
                        ? "Cancelando…"
                        : "Cancelar"}
                    </button>
                    {rowState?.status === "error" && (
                      <p role="alert">{rowState.message}</p>
                    )}
                  </>
                )}
                {isReportViewableEntry(entry) && scanId && (
                  <button
                    type="button"
                    aria-label={`Ver reporte de ${entry.target}`}
                    onClick={() => onViewReport(scanId)}
                  >
                    Ver reporte
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
