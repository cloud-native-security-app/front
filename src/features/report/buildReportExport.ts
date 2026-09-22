/**
 * Construcción pura (sin IO) del contenido a exportar del reporte
 * consolidado (RF-11, criterio 3): se reutiliza literalmente el
 * `ScanResult` ya mostrado en pantalla, serializado como JSON legible —
 * ver `docs/security-scope.md`/`feature_list.json` (id 7): sin
 * dependencias nuevas (nada de librerías de PDF), `Blob` + `<a download>`
 * alcanza. Separado de `downloadTextFile` (que sí toca el DOM) para poder
 * testear el contenido exportado sin necesitar `URL.createObjectURL`.
 */

import type { ScanResult } from "../../api";

export interface ReportExportFile {
  filename: string;
  mimeType: string;
  content: string;
}

export function buildReportExport(
  scanId: string,
  report: ScanResult,
): ReportExportFile {
  return {
    filename: `reporte-escaneo-${scanId}.json`,
    mimeType: "application/json",
    content: JSON.stringify(report, null, 2),
  };
}
