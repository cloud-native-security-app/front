/**
 * Single mapping from the REST status enum to user-facing labels
 * (feature `user-facing-copy`, UFC-03).
 */
import { describe, expect, it } from "vitest";

import {
  CONNECTION_STATUS_LABEL,
  SCAN_STATUS_LABEL,
  isTerminalScanStatus,
} from "../../../src/features/scan/scanStatus";

describe("scan status labels", () => {
  it("maps_every_enum_value_to_its_spanish_label", () => {
    expect(SCAN_STATUS_LABEL).toEqual({
      PENDIENTE: "En cola",
      EN_PROGRESO: "Escaneando…",
      COMPLETADO: "Completado",
      FALLIDO: "Falló",
    });
  });

  it("flags_only_COMPLETADO_and_FALLIDO_as_terminal", () => {
    expect(isTerminalScanStatus("COMPLETADO")).toBe(true);
    expect(isTerminalScanStatus("FALLIDO")).toBe(true);
    expect(isTerminalScanStatus("PENDIENTE")).toBe(false);
    expect(isTerminalScanStatus("EN_PROGRESO")).toBe(false);
  });

  it("labels_connection_states_in_spanish", () => {
    expect(CONNECTION_STATUS_LABEL).toEqual({
      connecting: "conectando…",
      open: "en vivo",
      reconnecting: "reconectando…",
      closed: "sin conexión",
    });
  });
});
