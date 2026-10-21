/**
 * Renderizado puro del reporte consolidado de un escaneo `COMPLETADO`
 * (RF-11, criterio 1): recibe el `ScanResult` ya cargado como prop, sin
 * conocer `src/api` — mismo espíritu que `HistoryTableView` (separado del
 * contenedor `ReportView`, que sí llama a `getReport`, para poder testear
 * la estructura mostrada con datos de ejemplo sin red, ver
 * `docs/conventions.md`/`docs/verification.md`).
 *
 * Nunca se vuelca el `ScanResult` como JSON crudo en pantalla: cada campo
 * (host, puertos, vulnerabilidades, severidad) se muestra en su propio
 * elemento estructurado. El contenido de texto libre que viene del backend
 * (`description` de una vulnerabilidad) se renderiza como texto JSX normal
 * — React lo escapa por defecto, nunca `dangerouslySetInnerHTML` (ver
 * `docs/security-scope.md`).
 */

import { useEffect, useRef } from "react";

import type { ScanResult, VulnerabilitySeverity } from "../../api";
import { EXPORT_REPORT_LABEL } from "../../copy";

const SEVERITY_LABEL: Record<VulnerabilitySeverity, string> = {
  unknown: "Desconocida",
  info: "Informativa",
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
};

export interface ReportDetailsProps {
  scanId: string;
  report: ScanResult;
  onExport: () => void;
}

function formatScannedAt(isoDate: string): string {
  const parsed = new Date(isoDate);
  return Number.isNaN(parsed.getTime()) ? isoDate : parsed.toLocaleString();
}

export function ReportDetails({
  scanId,
  report,
  onExport,
}: ReportDetailsProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Opening a report moves focus to its heading (feature
  // `sectioned-navigation`, SNV-04).
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-label={`Reporte del escaneo ${scanId}`}>
      <h2 ref={headingRef} tabIndex={-1}>
        Reporte de {report.host}
      </h2>
      <p>Escaneado: {formatScannedAt(report.scanned_at)}</p>
      <button type="button" onClick={onExport}>
        {EXPORT_REPORT_LABEL}
      </button>

      <h3>Puertos y servicios</h3>
      {report.ports.length === 0 ? (
        <p role="status">No se detectaron puertos abiertos.</p>
      ) : (
        <table>
          <caption>Puertos y servicios detectados</caption>
          <thead>
            <tr>
              <th scope="col">Puerto</th>
              <th scope="col">Protocolo</th>
              <th scope="col">Estado</th>
              <th scope="col">Servicio</th>
              <th scope="col">Versión</th>
              <th scope="col">
                <abbr title="Common Platform Enumeration: identificador estándar del software detectado en el puerto.">
                  CPE
                </abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            {report.ports.map((port) => (
              <tr key={`${port.protocol}-${port.port}`}>
                <td>{port.port}</td>
                <td>{port.protocol}</td>
                <td>{port.state}</td>
                <td>{port.service ?? "—"}</td>
                <td>{port.version ?? "—"}</td>
                <td>{port.cpes.length > 0 ? port.cpes.join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Vulnerabilidades</h3>
      {report.vulnerabilities.length === 0 ? (
        <p role="status">No se detectaron vulnerabilidades.</p>
      ) : (
        <ul>
          {report.vulnerabilities.map((vulnerability, index) => (
            <li key={`${vulnerability.id ?? "sin-id"}-${index}`}>
              <p>
                <strong>{vulnerability.id ?? "Sin identificador"}</strong>{" "}
                <span
                  className="severity-badge"
                  data-severity={vulnerability.severity}
                >
                  {SEVERITY_LABEL[vulnerability.severity]}
                </span>{" "}
                (fuente: {vulnerability.source})
              </p>
              <p>{vulnerability.description}</p>
              <p>
                <abbr title="Script del Nmap Scripting Engine que detectó este hallazgo.">
                  Script NSE
                </abbr>
                : {vulnerability.nse_script}
              </p>
              {vulnerability.references.length > 0 && (
                <ul>
                  {vulnerability.references.map((reference) => (
                    <li key={reference}>
                      <a href={reference}>{reference}</a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
