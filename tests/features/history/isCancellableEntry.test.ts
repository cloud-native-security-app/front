/**
 * Test unitario del validador puro `isCancellableEntry` (feature
 * `scan_history`, criterio 2): una entrada en `PENDIENTE`/`EN_PROGRESO`
 * con `scanId` es cancelable; `COMPLETADO`/`FALLIDO` no lo es;
 * y — sin importar el estado — una entrada sin `scanId` (campo opcional
 * del contrato, ver `src/api/types.ts:23`) nunca es cancelable.
 */
import { describe, expect, it } from "vitest";

import { isCancellableEntry } from "../../../src/features/history/isCancellableEntry";

describe("isCancellableEntry", () => {
  it("es_cancelable_si_esta_pendiente_y_tiene_scanId", () => {
    expect(isCancellableEntry({ scanId: "scan-1", status: "PENDIENTE" })).toBe(
      true,
    );
  });

  it("es_cancelable_si_esta_en_progreso_y_tiene_scanId", () => {
    expect(
      isCancellableEntry({ scanId: "scan-1", status: "EN_PROGRESO" }),
    ).toBe(true);
  });

  it("no_es_cancelable_si_esta_completado", () => {
    expect(isCancellableEntry({ scanId: "scan-1", status: "COMPLETADO" })).toBe(
      false,
    );
  });

  it("no_es_cancelable_si_esta_fallido", () => {
    expect(isCancellableEntry({ scanId: "scan-1", status: "FALLIDO" })).toBe(
      false,
    );
  });

  it("no_es_cancelable_sin_scanId_sin_importar_el_estado", () => {
    expect(isCancellableEntry({ scanId: undefined, status: "PENDIENTE" })).toBe(
      false,
    );
    expect(
      isCancellableEntry({ scanId: undefined, status: "EN_PROGRESO" }),
    ).toBe(false);
  });
});
