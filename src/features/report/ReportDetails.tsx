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

import { useEffect, useRef, useState } from "react";

import type {
  ScanResult,
  ScanVulnerability,
  VulnerabilitySeverity,
} from "../../api";
import {
  CONFIDENCE_CONFIRMED_LABEL,
  CONFIDENCE_VERSION_MATCH_LABEL,
  CONFIDENCE_VERSION_MATCH_NOTE,
  CONFIRMED_GROUP_TITLE,
  EXPORT_REPORT_LABEL,
  NO_FINDINGS_FOR_FILTER_MESSAGE,
  SEVERITY_FILTER_HINT,
  SEVERITY_LABEL,
  SEVERITY_SUMMARY_LABEL,
  VERSION_MATCH_GROUP_TITLE,
  cveLinkLabel,
} from "../../copy";

/** Most severe first; also the order of the summary buttons. */
const SEVERITY_ORDER: readonly VulnerabilitySeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
  "unknown",
];

/** Decorative glyphs (aria-hidden): the label text carries the meaning. */
const SEVERITY_ICON: Record<VulnerabilitySeverity, string> = {
  critical: "⛔",
  high: "▲",
  medium: "◆",
  low: "▼",
  info: "ℹ",
  unknown: "?",
};

/** "Posibles" start collapsed when there are more than this many. */
const POSSIBLE_COLLAPSE_THRESHOLD = 8;

const CVE_ID = /^CVE-/;

const CONFIDENCE_LABEL: Record<string, string> = {
  confirmed: CONFIDENCE_CONFIRMED_LABEL,
  version_match: CONFIDENCE_VERSION_MATCH_LABEL,
};

function confidenceLabel(confidence: string | undefined): string | undefined {
  return confidence !== undefined && Object.hasOwn(CONFIDENCE_LABEL, confidence)
    ? CONFIDENCE_LABEL[confidence]
    : undefined;
}

function bySeverity(a: ScanVulnerability, b: ScanVulnerability): number {
  return (
    SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );
}

function FindingId({ id }: { id: string | null | undefined }) {
  if (id === null || id === undefined) {
    return <strong>Sin identificador</strong>;
  }
  if (!CVE_ID.test(id)) {
    return <strong>{id}</strong>;
  }
  return (
    <strong>
      <a
        href={`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(id)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={cveLinkLabel(id)}
      >
        {id}
      </a>
    </strong>
  );
}

function FindingList({ findings }: { findings: ScanVulnerability[] }) {
  return (
    <ul>
      {findings.map((vulnerability, index) => (
        <li key={`${vulnerability.id ?? "sin-id"}-${index}`}>
          <p>
            <FindingId id={vulnerability.id} />{" "}
            <span
              className="severity-badge"
              data-severity={vulnerability.severity}
            >
              <span className="severity-badge-icon" aria-hidden="true">
                {SEVERITY_ICON[vulnerability.severity]}
              </span>
              {SEVERITY_LABEL[vulnerability.severity]}
            </span>{" "}
            {confidenceLabel(vulnerability.confidence) && (
              <>
                <span
                  className="confidence-badge"
                  data-confidence={vulnerability.confidence}
                >
                  {confidenceLabel(vulnerability.confidence)}
                </span>{" "}
              </>
            )}
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
  );
}

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

  const [hidden, setHidden] = useState<ReadonlySet<VulnerabilitySeverity>>(
    new Set(),
  );

  const all = report.vulnerabilities;
  const counts = SEVERITY_ORDER.map((severity) => ({
    severity,
    count: all.filter((v) => v.severity === severity).length,
  })).filter(({ count }) => count > 0);

  const visible = all.filter((v) => !hidden.has(v.severity)).sort(bySeverity);
  const possible = visible.filter((v) => v.confidence === "version_match");
  const confirmed = visible.filter((v) => v.confidence !== "version_match");
  const totalPossible = all.filter(
    (v) => v.confidence === "version_match",
  ).length;

  const toggleSeverity = (severity: VulnerabilitySeverity) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

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
      {all.length === 0 ? (
        <p role="status">No se detectaron vulnerabilidades.</p>
      ) : (
        <>
          <div role="group" aria-label={SEVERITY_SUMMARY_LABEL}>
            <ul className="severity-summary">
              {counts.map(({ severity, count }) => (
                <li key={severity}>
                  <button
                    type="button"
                    className="severity-badge severity-toggle"
                    data-severity={severity}
                    aria-pressed={!hidden.has(severity)}
                    onClick={() => toggleSeverity(severity)}
                  >
                    <span className="severity-badge-icon" aria-hidden="true">
                      {SEVERITY_ICON[severity]}
                    </span>
                    {`${SEVERITY_LABEL[severity]}: ${count}`}
                  </button>
                </li>
              ))}
            </ul>
            <p className="field-help">{SEVERITY_FILTER_HINT}</p>
          </div>

          {visible.length === 0 && (
            <p role="status">{NO_FINDINGS_FOR_FILTER_MESSAGE}</p>
          )}

          {confirmed.length > 0 && (
            <>
              <h4>{`${CONFIRMED_GROUP_TITLE} (${confirmed.length})`}</h4>
              <FindingList findings={confirmed} />
            </>
          )}

          {possible.length > 0 && (
            <details
              className="finding-group"
              open={totalPossible <= POSSIBLE_COLLAPSE_THRESHOLD}
            >
              <summary>{`${VERSION_MATCH_GROUP_TITLE} (${possible.length})`}</summary>
              <p>{CONFIDENCE_VERSION_MATCH_NOTE}</p>
              <FindingList findings={possible} />
            </details>
          )}
        </>
      )}
    </section>
  );
}
