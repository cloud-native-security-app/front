/**
 * Single mapping from the REST status enum (`src/api/types.ts`) to the
 * labels shown to the user (feature `user-facing-copy`, UFC-03). History,
 * the scan form's live status and the report all read from here.
 */

import type { ConnectionStatus, ScanStatus } from "../../api";

export const SCAN_STATUS_LABEL: Record<ScanStatus, string> = {
  PENDIENTE: "En cola",
  EN_PROGRESO: "Escaneando…",
  COMPLETADO: "Completado",
  FALLIDO: "Falló",
};

export const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: "conectando…",
  open: "en vivo",
  reconnecting: "reconectando…",
  closed: "sin conexión",
};

export function isTerminalScanStatus(status: ScanStatus): boolean {
  return status === "COMPLETADO" || status === "FALLIDO";
}
