/**
 * Test de componente de `HistoryTable` (el contenedor real: feature
 * `scan_history`, criterios 1/3/4/5) contra el servidor de contrato real
 * (`getScanHistory`/`submitScan`/`cancelScan` de `src/api`, nunca
 * `vi.mock` — ver docs/verification.md Nivel 2 y el mismo patrón que
 * `tests/features/scan/ScanForm.test.tsx`/`tests/api/scans.test.ts`). No
 * necesita el stub de `subscribeToScanEvents` que sí requiere
 * `ScanForm.test.tsx`: `HistoryTable` nunca abre un `EventSource` (ver
 * decisión de "refetch simple" documentada en `HistoryTable.tsx`).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cancelScan, submitScan } from "../../../src/api";
import { HistoryTable } from "../../../src/features/history";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../../api/testHelpers";

describe("HistoryTable", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("lista_el_historico_via_getScanHistory_mostrando_objetivo_estado_y_fecha", async () => {
    await loginAsSyntheticUser();
    await submitScan("10.1.0.10");

    render(<HistoryTable />);

    await waitFor(() => {
      expect(screen.getByText("10.1.0.10")).toBeInTheDocument();
    });
    const row = screen.getByText("10.1.0.10").closest("tr");
    expect(row).toHaveTextContent("PENDIENTE");
    // Fecha (año actual) renderizada en la fila, no un `undefined`/JSON crudo.
    expect(row?.textContent).toMatch(/\d{4}/);
  });

  it("una_entrada_pendiente_muestra_la_accion_de_cancelar", async () => {
    await loginAsSyntheticUser();
    await submitScan("10.1.0.13");

    render(<HistoryTable />);

    expect(
      await screen.findByRole("button", {
        name: "Cancelar escaneo de 10.1.0.13",
      }),
    ).toBeInTheDocument();
  });

  it("cancelar_un_escaneo_en_curso_refleja_el_nuevo_estado_sin_recargar_la_pagina", async () => {
    await loginAsSyntheticUser();
    await submitScan("10.1.0.11");

    render(<HistoryTable />);

    const button = await screen.findByRole("button", {
      name: "Cancelar escaneo de 10.1.0.11",
    });
    await userEvent.click(button);

    await waitFor(() => {
      const row = screen.getByText("10.1.0.11").closest("tr");
      expect(row).toHaveTextContent("FALLIDO");
    });
    expect(
      screen.queryByRole("button", { name: "Cancelar escaneo de 10.1.0.11" }),
    ).not.toBeInTheDocument();
  });

  it("un_error_al_cancelar_se_muestra_explicito_sin_dejar_el_boton_colgado", async () => {
    await loginAsSyntheticUser();
    const submitted = await submitScan("10.1.0.12");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }

    render(<HistoryTable />);

    const button = await screen.findByRole("button", {
      name: "Cancelar escaneo de 10.1.0.12",
    });

    // Simula la carrera del criterio 4 ("el escaneo ya terminó justo
    // antes"): se cancela "por fuera" del componente justo antes del
    // click, para que el click del usuario dispare el 409 real del
    // servidor de contrato.
    const preCancel = await cancelScan(submitted.value.scanId);
    expect(preCancel.ok).toBe(true);

    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /ya no se puede cancelar/i,
      );
    });
    // La fila no queda en un estado de carga colgado: el botón sigue
    // habilitado (no "Cancelando…" para siempre).
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent("Cancelar");
  });
});
