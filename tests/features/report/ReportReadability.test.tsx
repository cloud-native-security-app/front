/**
 * Report readability (RRD-01..05): severity summary + filter, confidence
 * groups with a collapsible "Posibles" disclosure, severity badge with an
 * icon, and NVD links for CVE ids. Pure `ReportDetails` with fabricated data.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScanResult, VulnerabilitySeverity } from "../../../src/api";
import { ReportDetails } from "../../../src/features/report/ReportDetails";

const finding = (
  id: string,
  severity: VulnerabilitySeverity,
  confidence?: "confirmed" | "version_match",
) => ({
  id,
  severity,
  description: `desc ${id}`,
  nse_script: "script",
  source: "nmap_nse" as const,
  references: [],
  ...(confidence === undefined ? {} : { confidence }),
});

function reportWith(vulnerabilities: ReturnType<typeof finding>[]): ScanResult {
  return {
    host: "10.5.0.1",
    ports: [],
    vulnerabilities,
    scanned_at: "2026-01-01T00:00:00.000Z",
  } as ScanResult;
}

const MIXED = reportWith([
  finding("CVE-2020-0001", "critical", "confirmed"),
  finding("CVE-2020-0002", "high", "confirmed"),
  finding("CVE-2020-0003", "high", "version_match"),
  finding("CVE-2020-0004", "low", "version_match"),
]);

function manyPosibles(count: number): ScanResult {
  return reportWith([
    finding("CVE-2020-1000", "high", "confirmed"),
    ...Array.from({ length: count }, (_, i) =>
      finding(`CVE-2021-${2000 + i}`, "medium", "version_match"),
    ),
  ]);
}

const renderReport = (report: ScanResult, onExport = vi.fn()) =>
  render(<ReportDetails scanId="s" report={report} onExport={onExport} />);

describe("severity summary (RRD-01)", () => {
  afterEach(cleanup);

  it("muestra_conteos_por_severidad_con_texto_y_oculta_los_ceros", () => {
    renderReport(MIXED);
    const summary = screen.getByRole("group", {
      name: /resumen por severidad/i,
    });
    expect(within(summary).getByText("Crítica: 1")).toBeInTheDocument();
    expect(within(summary).getByText("Alta: 2")).toBeInTheDocument();
    expect(within(summary).getByText("Baja: 1")).toBeInTheDocument();
    expect(within(summary).queryByText(/Media/)).not.toBeInTheDocument();
    expect(within(summary).queryByText(/Desconocida/)).not.toBeInTheDocument();
  });
});

describe("severity filter (RRD-02)", () => {
  afterEach(cleanup);

  it("ocultar_una_severidad_quita_sus_filas_y_aria_pressed_lo_refleja", async () => {
    renderReport(MIXED);
    const toggle = screen.getByRole("button", { name: "Alta: 2" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("CVE-2020-0002")).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("CVE-2020-0002")).not.toBeInTheDocument();
    expect(screen.queryByText("CVE-2020-0003")).not.toBeInTheDocument();
    expect(screen.getByText("CVE-2020-0001")).toBeInTheDocument();

    await userEvent.click(toggle);
    expect(screen.getByText("CVE-2020-0002")).toBeInTheDocument();
  });

  it("si_todo_esta_filtrado_avisa_que_no_hay_coincidencias", async () => {
    renderReport(reportWith([finding("CVE-2020-0001", "high", "confirmed")]));
    await userEvent.click(screen.getByRole("button", { name: "Alta: 1" }));
    expect(screen.getByText(/ningún hallazgo coincide/i)).toBeInTheDocument();
  });
});

describe("export keeps the full report (RRD-02)", () => {
  afterEach(cleanup);

  it("exportar_con_un_filtro_activo_exporta_el_reporte_completo", async () => {
    const downloadTextFile = vi.fn();
    vi.resetModules();
    vi.doMock("../../../src/features/report/downloadTextFile", () => ({
      downloadTextFile,
    }));
    vi.doMock("../../../src/api", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../../../src/api")>()),
      getReport: () => Promise.resolve({ ok: true, value: MIXED }),
    }));
    const { ReportView } =
      await import("../../../src/features/report/ReportView");
    render(<ReportView scanId="scan-9" />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Alta: 2" }),
    );
    expect(screen.queryByText("CVE-2020-0002")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /exportar reporte/i }),
    );

    expect(downloadTextFile).toHaveBeenCalledTimes(1);
    const payload = JSON.stringify(downloadTextFile.mock.calls[0]);
    for (const id of [
      "CVE-2020-0001",
      "CVE-2020-0002",
      "CVE-2020-0003",
      "CVE-2020-0004",
    ]) {
      expect(payload).toContain(id);
    }
    vi.doUnmock("../../../src/features/report/downloadTextFile");
    vi.doUnmock("../../../src/api");
  });
});

describe("confidence groups (RRD-03)", () => {
  afterEach(cleanup);

  it("las_posibles_van_en_un_details_abierto_si_son_pocas", () => {
    renderReport(MIXED);
    const summary = screen.getByText(/Posibles \(según versión\) \(2\)/);
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    expect(details).toHaveAttribute("open");
    expect(
      screen.getByRole("heading", { name: /Confirmadas \(2\)/ }),
    ).toBeInTheDocument();
  });

  it("con_mas_de_8_posibles_el_details_esta_colapsado_y_se_puede_expandir", async () => {
    renderReport(manyPosibles(9));
    const summary = screen.getByText(/Posibles \(según versión\) \(9\)/);
    const details = summary.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(screen.getByText("CVE-2020-1000")).toBeVisible();

    await userEvent.click(summary);
    expect(details.open).toBe(true);
  });

  it("con_8_posibles_no_se_colapsa", () => {
    renderReport(manyPosibles(8));
    const details = screen
      .getByText(/Posibles \(según versión\) \(8\)/)
      .closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(true);
  });

  it("sin_posibles_no_hay_grupo_posibles_vacio", () => {
    renderReport(reportWith([finding("CVE-2020-0001", "high", "confirmed")]));
    expect(screen.queryByText(/Posibles/)).not.toBeInTheDocument();
    expect(document.querySelector("details")).toBeNull();
  });

  it("dentro_de_cada_grupo_ordena_por_severidad_descendente", () => {
    renderReport(
      reportWith([
        finding("CVE-2020-0001", "low", "confirmed"),
        finding("CVE-2020-0002", "critical", "confirmed"),
      ]),
    );
    const ids = screen.getAllByText(/^CVE-2020-000/).map((e) => e.textContent);
    expect(ids).toEqual(["CVE-2020-0002", "CVE-2020-0001"]);
  });
});

describe("severity badge (RRD-04)", () => {
  afterEach(cleanup);

  it("incluye_texto_y_un_icono_decorativo", () => {
    renderReport(
      reportWith([finding("CVE-2020-0001", "critical", "confirmed")]),
    );
    const badge = screen
      .getAllByText("Crítica")
      .find((e) => e.classList.contains("severity-badge"));
    expect(badge).toBeDefined();
    const icon = badge?.querySelector(".severity-badge-icon");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon?.textContent?.length).toBeGreaterThan(0);
  });
});

describe("CVE links (RRD-05)", () => {
  afterEach(cleanup);

  it("un_id_CVE_enlaza_a_NVD_en_una_pestana_nueva_con_nombre_accesible", () => {
    renderReport(reportWith([finding("CVE-2025-26465", "high", "confirmed")]));
    const link = screen.getByRole("link", {
      name: "Ver CVE-2025-26465 en NVD",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://nvd.nist.gov/vuln/detail/CVE-2025-26465",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("un_id_que_no_es_CVE_se_muestra_como_texto_plano", () => {
    renderReport(reportWith([finding("EDB-12345", "high", "confirmed")]));
    expect(screen.getByText("EDB-12345")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /EDB-12345/ })).toBeNull();
  });
});
