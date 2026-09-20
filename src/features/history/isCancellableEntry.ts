/**
 * Validador puro (sin IO, mismo espíritu que `validateScanTarget` de
 * `src/features/scan`): decide si una entrada del histórico (RF-13) debe
 * mostrar la acción de cancelar (RF-14). `scanId` es opcional en el wire
 * format real (ver `src/api/types.ts`) — una entrada sin `scanId` nunca es
 * cancelable, sin importar su `status`, porque no hay forma de llamar a
 * `cancelScan` sin él.
 */

import type { ScanHistoryEntry, ScanStatus } from "../../api";

const CANCELLABLE_STATUSES: ReadonlySet<ScanStatus> = new Set([
  "PENDIENTE",
  "EN_PROGRESO",
]);

export function isCancellableEntry(
  entry: Pick<ScanHistoryEntry, "scanId" | "status">,
): boolean {
  return Boolean(entry.scanId) && CANCELLABLE_STATUSES.has(entry.status);
}
