// @vitest-environment node
//
// Ver la nota equivalente en `tests/api/scanEvents.test.ts`: este archivo
// dirige un scan hasta un estado terminal usando `subscribeToScanEvents`
// (EventSource), que bajo jsdom choca con el `Event` global que jsdom
// reemplaza. No renderiza DOM, así que no pierde cobertura.
import { beforeEach, describe, expect, it } from "vitest";

import { getReport, submitScan, subscribeToScanEvents } from "../../src/api";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "./testHelpers";

/** Recorre el guion SSE completo de un scan para que el servidor de contrato lo marque como COMPLETADO/FALLIDO. */
function runToTerminalState(scanId: string): Promise<void> {
  return new Promise((resolve) => {
    subscribeToScanEvents(
      scanId,
      () => {},
      (status) => {
        if (status === "closed") {
          resolve();
        }
      },
    );
  });
}

describe("getReport", () => {
  useContractServer();

  beforeEach(async () => {
    clearNodeTestSessionCookies();
    await loginAsSyntheticUser();
  });

  it("devuelve_el_resultado_cuando_el_scan_esta_completado", async () => {
    const submitted = await submitScan("10.0.0.20");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }
    await runToTerminalState(submitted.value.scanId);

    const result = await getReport(submitted.value.scanId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.host).toBe("10.0.0.20");
      expect(result.value.ports.length).toBeGreaterThan(0);
    }
  });

  it("mapea_409_a_not_ready_cuando_el_scan_aun_no_esta_completado", async () => {
    const submitted = await submitScan("10.0.0.21");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }

    const result = await getReport(submitted.value.scanId);

    expect(result).toEqual({ ok: false, error: { kind: "not_ready" } });
  });

  it("mapea_404_a_not_found_para_un_scanId_inexistente", async () => {
    const result = await getReport("no-existe");

    expect(result).toEqual({ ok: false, error: { kind: "not_found" } });
  });
});
