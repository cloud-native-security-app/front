/**
 * Test de componente de `ReportDetails` (feature `report_view`, criterios
 * 1/4/5): renderiza la estructura del reporte (objetivo, puertos,
 * vulnerabilidades, severidad) a partir de un `ScanResult` fabricado como
 * prop — mismo patrón "componente puro" que `HistoryTableView.test.tsx`,
 * sin red ni mockear `src/api`.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScanResult } from "../../../src/api";
import { ReportDetails } from "../../../src/features/report/ReportDetails";

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
    {
      port: 8080,
      protocol: "tcp",
      state: "open",
      service: null,
      version: null,
      cpes: [],
    },
  ],
  vulnerabilities: [
    {
      id: "CVE-2023-38408",
      severity: "high",
      description: "<script>alert('xss')</script> texto libre del backend.",
      nse_script: "ssh-vuln-cve-2023-38408",
      source: "nmap_nse",
      references: ["https://nvd.nist.gov/vuln/detail/CVE-2023-38408"],
    },
  ],
  scanned_at: "2026-01-01T00:00:00.000Z",
};

describe("ReportDetails", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra_el_objetivo_los_puertos_y_las_vulnerabilidades_de_forma_estructurada", () => {
    render(
      <ReportDetails scanId="scan-1" report={REPORT} onExport={vi.fn()} />,
    );

    expect(
      screen.getByRole("heading", { name: /reporte de 10\.5\.0\.1/i }),
    ).toBeInTheDocument();

    const portRow = screen.getByText("22").closest("tr");
    expect(portRow).toHaveTextContent("tcp");
    expect(portRow).toHaveTextContent("ssh");
    expect(portRow).toHaveTextContent("OpenSSH 9.6");

    expect(screen.getByText("CVE-2023-38408")).toBeInTheDocument();
    expect(screen.getByText(/severidad: high/i)).toBeInTheDocument();
  });

  it("nunca_vuelca_el_reporte_como_json_crudo_en_pantalla", () => {
    render(
      <ReportDetails scanId="scan-1" report={REPORT} onExport={vi.fn()} />,
    );

    expect(screen.queryByText(/"host":/)).not.toBeInTheDocument();
    expect(document.querySelector("pre")).not.toBeInTheDocument();
  });

  it("el_texto_libre_del_backend_se_escapa_en_vez_de_interpretarse_como_html", () => {
    render(
      <ReportDetails scanId="scan-1" report={REPORT} onExport={vi.fn()} />,
    );

    // React escapa por defecto: el texto literal es visible como texto,
    // nunca se inserta un elemento <script> real en el DOM.
    expect(
      screen.getByText(/<script>alert\('xss'\)<\/script>/),
    ).toBeInTheDocument();
    expect(document.querySelector("script[data-injected]")).toBeNull();
  });

  it("llama_a_onExport_al_hacer_click_en_exportar", async () => {
    const onExport = vi.fn();
    render(
      <ReportDetails scanId="scan-1" report={REPORT} onExport={onExport} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: /exportar reporte/i }),
    );

    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("muestra_estados_vacios_explicitos_cuando_no_hay_puertos_ni_vulnerabilidades", () => {
    const emptyReport: ScanResult = {
      host: "10.5.0.2",
      ports: [],
      vulnerabilities: [],
      scanned_at: "2026-01-01T00:00:00.000Z",
    };

    render(
      <ReportDetails scanId="scan-2" report={emptyReport} onExport={vi.fn()} />,
    );

    expect(
      screen.getByText(/no se detectaron puertos abiertos/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no se detectaron vulnerabilidades/i),
    ).toBeInTheDocument();
  });
});
