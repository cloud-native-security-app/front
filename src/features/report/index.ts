/**
 * Visualización y exportación del reporte consolidado de un escaneo
 * (ver docs/architecture.md, capa 5: "src/features/report").
 */

export { ReportView } from "./ReportView";
export type { ReportViewProps } from "./ReportView";
export { ReportDetails } from "./ReportDetails";
export type { ReportDetailsProps } from "./ReportDetails";
export { buildReportExport } from "./buildReportExport";
export type { ReportExportFile } from "./buildReportExport";
export { downloadTextFile } from "./downloadTextFile";
