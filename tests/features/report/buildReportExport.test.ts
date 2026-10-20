/**
 * Test unitario de `buildReportExport` (feature `report_view`, criterio
 * 3): función pura que arma el contenido a exportar a partir del
 * `ScanResult` ya mostrado en pantalla — sin tocar el DOM (esa parte,
 * `downloadTextFile`, se ejercita en `e2e/report-view.spec.ts` con un
 * navegador real, ver `docs/verification.md`).
 */
import { describe, expect, it } from "vitest";

import type { ScanResult } from "../../../src/api";
import { buildReportExport } from "../../../src/features/report/buildReportExport";

const REPORT: ScanResult = {
  host: "10.5.0.1",
  ports: [
    {
      port: 22,
      protocol: "tcp",
      state: "open",
      service: "ssh",
      version: "OpenSSH 9.6",
      cpes: ["cpe:/a:openbsd:openssh:9.6"],
    },
  ],
  vulnerabilities: [
    {
      id: "CVE-2023-38408",
      severity: "high",
      description: "Descripción de ejemplo.",
      nse_script: "ssh-vuln-cve-2023-38408",
      source: "nmap_nse",
      references: ["https://nvd.nist.gov/vuln/detail/CVE-2023-38408"],
    },
  ],
  scanned_at: "2026-01-01T00:00:00.000Z",
};

describe("buildReportExport", () => {
  it("produce_un_archivo_json_con_el_contenido_del_reporte_mostrado", () => {
    const file = buildReportExport("scan-123", REPORT);

    expect(file.filename).toBe("reporte-escaneo-scan-123.json");
    expect(file.mimeType).toBe("application/json");
    expect(JSON.parse(file.content)).toEqual(REPORT);
  });

  it("el_nombre_del_archivo_incluye_el_scanId_para_diferenciar_exportaciones", () => {
    const file = buildReportExport("otro-scan", REPORT);

    expect(file.filename).toContain("otro-scan");
  });
});
