/**
 * Validador puro (sin IO, mismo espíritu que `isCancellableEntry`): decide
 * si una entrada del histórico debe mostrar la acción "Ver reporte"
 * (RF-11, feature `report_view`). Igual que la cancelación, una entrada
 * sin `scanId` nunca puede pedir su reporte (no hay forma de llamar a
 * `getReport` sin él) — y solo tiene sentido para escaneos ya
 * `COMPLETADO` (ver `docs/architecture.md`, capa 5): un escaneo aún no
 * terminado responde `not_ready` (409), que la propia vista de reporte ya
 * traduce a un estado explicativo, pero no tiene sentido ofrecer la
 * acción antes de tiempo.
 */

import type { ScanHistoryEntry } from "../../api";

export function isReportViewableEntry(
  entry: Pick<ScanHistoryEntry, "scanId" | "status">,
): boolean {
  return Boolean(entry.scanId) && entry.status === "COMPLETADO";
}
