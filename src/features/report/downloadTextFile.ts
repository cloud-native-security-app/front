/**
 * Dispara la descarga de un archivo de texto generado en cliente (RF-11,
 * criterio 3): crea un `Blob`, un `<a download>` temporal apuntando a un
 * `URL.createObjectURL`, lo "clickea" mediante programación y libera el
 * object URL — sin dependencias nuevas (ver `feature_list.json`, id 7).
 * Efecto de lado puro DOM, deliberadamente separado de
 * `buildReportExport` (que sí es puro y testeable sin `jsdom`).
 */

import type { ReportExportFile } from "./buildReportExport";

export function downloadTextFile(file: ReportExportFile): void {
  const blob = new Blob([file.content], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
