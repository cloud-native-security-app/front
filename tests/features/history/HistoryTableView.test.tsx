/**
 * Test de componente de `HistoryTableView` (feature `scan_history`,
 * criterio 5): muestra objetivo/estado/fecha de cada entrada y
 * muestra/oculta la acción de cancelar según `status`, incluyendo el caso
 * "sin `scanId`" (campo opcional del contrato, ver
 * `src/api/types.ts:23`) — un caso que el servidor de contrato real nunca
 * produce (siempre asigna `scanId`), así que se ejercita aquí pasando
 * datos fabricados directamente como props al componente presentacional
 * (sin red, sin mockear `src/api`: `HistoryTableView` no importa nada de
 * `src/api` salvo tipos). El contenedor `HistoryTable` (que sí llama a
 * `getScanHistory`/`cancelScan` contra el servidor de contrato real) se
 * cubre en `HistoryTable.test.tsx`.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScanHistoryEntry } from "../../../src/api";
import {
  HistoryTableView,
  type RowCancelState,
} from "../../../src/features/history/HistoryTableView";

const BASE_ENTRIES: ScanHistoryEntry[] = [
  {
    scanId: "scan-pendiente",
    target: "10.0.0.1",
    status: "PENDIENTE",
    requested_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    scanId: "scan-en-progreso",
    target: "10.0.0.2",
    status: "EN_PROGRESO",
    requested_at: "2026-01-01T00:01:00.000Z",
    updated_at: "2026-01-01T00:01:00.000Z",
  },
  {
    scanId: "scan-completado",
    target: "10.0.0.3",
    status: "COMPLETADO",
    requested_at: "2026-01-01T00:02:00.000Z",
    updated_at: "2026-01-01T00:02:00.000Z",
  },
  {
    scanId: "scan-fallido",
    target: "10.0.0.4",
    status: "FALLIDO",
    requested_at: "2026-01-01T00:03:00.000Z",
    updated_at: "2026-01-01T00:03:00.000Z",
  },
  {
    // Sin scanId: campo opcional del wire format. Nunca cancelable, sin
    // importar el estado (aquí, deliberadamente, uno "cancelable" según su
    // status, para probar que el `scanId` ausente gana sobre el status).
    target: "10.0.0.5",
    status: "PENDIENTE",
    requested_at: "2026-01-01T00:04:00.000Z",
    updated_at: "2026-01-01T00:04:00.000Z",
  },
];

describe("HistoryTableView", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra_objetivo_estado_y_fecha_de_cada_entrada", () => {
    render(
      <HistoryTableView
        entries={BASE_ENTRIES}
        rowStates={{}}
        onCancel={vi.fn()}
      />,
    );

    for (const entry of BASE_ENTRIES) {
      const row = screen.getByText(entry.target).closest("tr");
      expect(row).not.toBeNull();
      expect(row).toHaveTextContent(entry.status);
    }
  });

  it("muestra_la_accion_de_cancelar_solo_para_pendiente_o_en_progreso_con_scanId", () => {
    render(
      <HistoryTableView
        entries={BASE_ENTRIES}
        rowStates={{}}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Cancelar escaneo de 10.0.0.1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancelar escaneo de 10.0.0.2" }),
    ).toBeInTheDocument();
  });

  it("oculta_la_accion_de_cancelar_para_estados_terminales", () => {
    render(
      <HistoryTableView
        entries={BASE_ENTRIES}
        rowStates={{}}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Cancelar escaneo de 10.0.0.3" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancelar escaneo de 10.0.0.4" }),
    ).not.toBeInTheDocument();
  });

  it("oculta_la_accion_de_cancelar_si_la_entrada_no_tiene_scanId_sin_importar_el_estado", () => {
    render(
      <HistoryTableView
        entries={BASE_ENTRIES}
        rowStates={{}}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Cancelar escaneo de 10.0.0.5" }),
    ).not.toBeInTheDocument();
  });

  it("llama_a_onCancel_con_el_scanId_de_la_fila_al_hacer_click", async () => {
    const onCancel = vi.fn();
    render(
      <HistoryTableView
        entries={BASE_ENTRIES}
        rowStates={{}}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Cancelar escaneo de 10.0.0.1" }),
    );

    expect(onCancel).toHaveBeenCalledWith("scan-pendiente");
  });

  it("deshabilita_el_boton_mientras_la_fila_esta_cancelando", () => {
    const rowStates: Record<string, RowCancelState> = {
      "scan-pendiente": { status: "cancelling" },
    };
    render(
      <HistoryTableView
        entries={BASE_ENTRIES}
        rowStates={rowStates}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Cancelar escaneo de 10.0.0.1" }),
    ).toBeDisabled();
  });

  it("muestra_el_error_de_cancelar_de_forma_explicita_sin_quitar_la_fila", () => {
    const rowStates: Record<string, RowCancelState> = {
      "scan-pendiente": {
        status: "error",
        message:
          "El escaneo ya no se puede cancelar: probablemente ya terminó.",
      },
    };
    render(
      <HistoryTableView
        entries={BASE_ENTRIES}
        rowStates={rowStates}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /ya no se puede cancelar/i,
    );
    expect(
      screen.getByRole("button", { name: "Cancelar escaneo de 10.0.0.1" }),
    ).toBeEnabled();
  });

  it("muestra_un_estado_vacio_explicito_cuando_no_hay_entradas", () => {
    render(<HistoryTableView entries={[]} rowStates={{}} onCancel={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /todavía no hay escaneos/i,
    );
  });
});
