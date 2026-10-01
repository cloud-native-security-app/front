/**
 * Test de componente del polling periódico de `HistoryTable` (feature
 * `history_polling_refresh`, id 16): mientras haya alguna entrada no
 * terminal (`PENDIENTE`/`EN_PROGRESO`), el componente debe refrescar el
 * histórico por sí mismo aunque nunca llegue el evento SSE correspondiente
 * (simula el corte del relay del Gateway confirmado en AWS, ver
 * `HistoryTable.tsx`). Mismo patrón que `HistoryTable.test.tsx`: contra el
 * servidor de contrato real, nunca `vi.mock` de `src/api`.
 *
 * El refetch "por fuera" del componente (sin pasar por la UI) se simula
 * igual que en `HistoryTable.test.tsx::un_error_al_cancelar...`: se llama a
 * `cancelScan`/`submitScan` directamente desde el test para cambiar el
 * estado real en el servidor de contrato sin que el componente lo sepa
 * todavía, y luego se avanza el tiempo con fake timers para verificar si el
 * polling lo recoge (o no).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cancelScan, submitScan } from "../../../src/api";
import { HistoryTable } from "../../../src/features/history";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../../api/testHelpers";

// Mismo valor que `HISTORY_POLL_INTERVAL_MS` en `HistoryTable.tsx` — no se
// importa directamente porque el componente no lo exporta (no hace falta
// fuera del propio módulo); si cambia ahí, hay que actualizarlo aquí.
const HISTORY_POLL_INTERVAL_MS = 7000;

/**
 * Solo se fakean `setInterval`/`clearInterval` (nunca `setTimeout`/`Date`):
 * estos tests siguen haciendo peticiones reales contra el servidor de
 * contrato (ver cabecera del archivo), y el cliente HTTP real de Node
 * (`undici`) depende internamente de `setTimeout` para resolver — fakearlo
 * también cuelga la petición indefinidamente. Acotar el fake timer a los
 * únicos timers que usa el polling de `HistoryTable` evita ese problema
 * mientras sigue permitiendo controlar el intervalo de forma determinista.
 */
function useFakePollingInterval(): void {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
}

describe("HistoryTable polling", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("con_entradas_no_terminales_avanzar_el_tiempo_dispara_un_refetch_adicional", async () => {
    await loginAsSyntheticUser();
    const submitted = await submitScan("10.1.0.30");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }

    // Los fake timers se activan ANTES de montar: el `setInterval` del
    // polling se crea dentro de un efecto al montar, y solo un timer creado
    // mientras los fake timers ya están activos queda bajo el reloj falso
    // (`vi.advanceTimersByTime` no adelanta un `setInterval` creado antes de
    // activarlos). El fetch real contra el servidor de contrato sigue
    // resolviendo por I/O real (los fake timers de Vitest solo reemplazan
    // `setTimeout`/`setInterval`/`Date`, nunca el loop de eventos de Node).
    useFakePollingInterval();

    render(<HistoryTable onViewReport={vi.fn()} />);

    const row = await screen.findByText("10.1.0.30").then((cell) => {
      const tr = cell.closest("tr");
      if (!tr) {
        throw new Error("fila del histórico no encontrada");
      }
      return tr;
    });
    expect(row).toHaveTextContent("PENDIENTE");

    // Cambia el estado real en el backend "por fuera" del componente, como
    // si el desenlace hubiera llegado sin que el SSE se lo notificara a
    // esta pestaña (feature description: corte del relay de gateway).
    const cancelResult = await cancelScan(submitted.value.scanId);
    expect(cancelResult.ok).toBe(true);

    // Dispara el `setInterval` del polling (creado bajo fake timers, ver
    // arriba) y deja que el refetch real se resuelva y llegue al DOM.
    await vi.advanceTimersByTimeAsync(HISTORY_POLL_INTERVAL_MS);

    await waitFor(() => {
      expect(row).toHaveTextContent("FALLIDO");
    });
  });

  it("con_todas_las_entradas_terminales_avanzar_el_tiempo_no_dispara_ningun_refetch", async () => {
    await loginAsSyntheticUser();
    const submitted = await submitScan("10.1.0.31");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }
    const cancelResult = await cancelScan(submitted.value.scanId);
    expect(cancelResult.ok).toBe(true);

    render(<HistoryTable onViewReport={vi.fn()} />);

    const row = await screen.findByText("10.1.0.31").then((cell) => {
      const tr = cell.closest("tr");
      if (!tr) {
        throw new Error("fila del histórico no encontrada");
      }
      return tr;
    });
    expect(row).toHaveTextContent("FALLIDO");

    // Todas las entradas cargadas son terminales: el polling no debería
    // estar activo. Se encola un escaneo nuevo directamente contra el
    // servidor de contrato (sin pasar por la UI) para que, si el polling
    // estuviera (incorrectamente) activo, su refetch lo revelaría.
    const second = await submitScan("10.1.0.32");
    if (!second.ok) {
      throw new Error("setup del test falló: segundo submitScan no exitoso");
    }

    useFakePollingInterval();
    vi.advanceTimersByTime(HISTORY_POLL_INTERVAL_MS * 2);
    vi.useRealTimers();

    // No hay ningún `setInterval` pendiente (el polling nunca arrancó), así
    // que no hay nada que esperar: si hubiera un refetch de más, ya se
    // habría disparado en el `advanceTimersByTime` de arriba. Se da un
    // respiro real breve para dejar que cualquier I/O pendiente (que no
    // debería existir) tenga tiempo de resolverse antes de afirmar la
    // ausencia.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(screen.queryByText("10.1.0.32")).not.toBeInTheDocument();
  });
});
