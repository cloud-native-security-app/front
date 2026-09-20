/**
 * Histórico de escaneos y cancelación (ver docs/architecture.md, capa 4:
 * "src/features/history").
 */

export { HistoryTable } from "./HistoryTable";
export { HistoryTableView } from "./HistoryTableView";
export type { HistoryTableViewProps, RowCancelState } from "./HistoryTableView";
export { isCancellableEntry } from "./isCancellableEntry";
