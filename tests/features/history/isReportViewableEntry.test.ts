/**
 * Test unitario del validador puro `isReportViewableEntry` (feature
 * `report_view`, criterio de aceptación implícito en el mecanismo de
 * selección descrito en `App.tsx`): solo una entrada `COMPLETADO` con
 * `scanId` habilita la acción "Ver reporte" — cualquier otro estado, o
 * una entrada sin `scanId` (campo opcional del contrato, ver
 * `src/api/types.ts:23`), no la habilita.
 */
import { describe, expect, it } from "vitest";

import { isReportViewableEntry } from "../../../src/features/history/isReportViewableEntry";

describe("isReportViewableEntry", () => {
  it("es_visible_si_esta_completado_y_tiene_scanId", () => {
    expect(
      isReportViewableEntry({ scanId: "scan-1", status: "COMPLETADO" }),
    ).toBe(true);
  });

  it("no_es_visible_si_esta_pendiente", () => {
    expect(
      isReportViewableEntry({ scanId: "scan-1", status: "PENDIENTE" }),
    ).toBe(false);
  });

  it("no_es_visible_si_esta_en_progreso", () => {
    expect(
      isReportViewableEntry({ scanId: "scan-1", status: "EN_PROGRESO" }),
    ).toBe(false);
  });

  it("no_es_visible_si_esta_fallido", () => {
    expect(isReportViewableEntry({ scanId: "scan-1", status: "FALLIDO" })).toBe(
      false,
    );
  });

  it("no_es_visible_sin_scanId_aunque_este_completado", () => {
    expect(
      isReportViewableEntry({ scanId: undefined, status: "COMPLETADO" }),
    ).toBe(false);
  });
});
