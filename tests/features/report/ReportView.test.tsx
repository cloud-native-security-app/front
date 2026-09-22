/**
 * Test de componente de `ReportView` (el contenedor real: feature
 * `report_view`, criterios 1/2) contra el servidor de contrato real
 * (`getReport`/`submitScan` de `src/api`, nunca `vi.mock` — ver
 * docs/verification.md Nivel 2 y el mismo patrón que
 * `tests/features/history/HistoryTable.test.tsx`).
 *
 * Para llevar un scan a `COMPLETADO` este archivo **no** usa
 * `subscribeToScanEvents`/`EventSource` (a diferencia de
 * `tests/api/report.test.ts`): ese archivo necesita el entorno `node`
 * (pragma de cabecera) para esquivar el choque de `EventSource` con el
 * `Event` global que jsdom reemplaza (ver comentario de cabecera de
 * `tests/features/scan/ScanForm.test.tsx`), pero este archivo sí necesita
 * DOM real (`render`) para probar `ReportView`. En vez de eso, se drena
 * directamente el mismo endpoint SSE con `fetch` (sin construir un
 * `EventSource`, así que no hay conflicto de `Event`): el guion del
 * servidor de contrato avanza igual con cualquier cliente que mantenga la
 * conexión abierta hasta que el stream termina.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { gatewayBaseUrl, submitScan } from "../../../src/api";
import { ReportView } from "../../../src/features/report/ReportView";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../../api/testHelpers";

/** Drena el stream SSE de un scan hasta que el servidor de contrato lo termina (COMPLETADO/FALLIDO), sin instanciar `EventSource`. */
async function runToTerminalState(scanId: string): Promise<void> {
  const response = await fetch(
    `${gatewayBaseUrl()}/api/scans/${encodeURIComponent(scanId)}/events`,
    { credentials: "include" },
  );
  await response.text();
}

describe("ReportView", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("obtiene_el_reporte_via_getReport_y_lo_muestra_estructurado_cuando_esta_completado", async () => {
    await loginAsSyntheticUser();
    const submitted = await submitScan("10.2.0.30");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }
    await runToTerminalState(submitted.value.scanId);

    render(<ReportView scanId={submitted.value.scanId} />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /reporte de 10\.2\.0\.30/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /exportar reporte/i }),
    ).toBeInTheDocument();
  });

  it("un_scan_no_completado_muestra_un_estado_explicativo_no_un_error_generico", async () => {
    await loginAsSyntheticUser();
    const submitted = await submitScan("10.2.0.31");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }

    render(<ReportView scanId={submitted.value.scanId} />);

    await waitFor(() => {
      expect(
        screen.getByText(/el escaneo todavía no ha terminado/i),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("un_scanId_inexistente_muestra_un_error_explicito", async () => {
    await loginAsSyntheticUser();

    render(<ReportView scanId="no-existe" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /el reporte no existe/i,
      );
    });
  });
});
