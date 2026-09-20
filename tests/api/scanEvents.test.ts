// @vitest-environment node
//
// Este archivo corre en el entorno "node" (no "jsdom", el default del
// proyecto): el polyfill de `EventSource` de `undici` construye sus
// eventos con el `Event` global nativo de Node (`new Event('error')`,
// código de la librería, no nuestro). jsdom reemplaza ese global con su
// propia clase `Event`, y el `dispatchEvent` nativo de Node (del que
// hereda `EventSource`) rechaza esa instancia por pertenecer a una clase
// distinta ("Received an instance of Event" — mismo nombre, distinta
// identidad, confirmado en este entorno). Ninguno de estos tests renderiza
// DOM, así que no pierden cobertura al no usar jsdom.
import { beforeEach, describe, expect, it } from "vitest";

import {
  submitScan,
  subscribeToScanEvents,
  type ConnectionStatus,
  type ScanOutcomeEvent,
} from "../../src/api";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "./testHelpers";

interface Recorded {
  events: ScanOutcomeEvent[];
  statuses: ConnectionStatus[];
}

function subscribeUntilClosed(scanId: string): Promise<Recorded> {
  const events: ScanOutcomeEvent[] = [];
  const statuses: ConnectionStatus[] = [];
  return new Promise((resolve) => {
    subscribeToScanEvents(
      scanId,
      (event) => events.push(event),
      (status) => {
        statuses.push(status);
        if (status === "closed") {
          resolve({ events, statuses });
        }
      },
    );
  });
}

describe("subscribeToScanEvents", () => {
  useContractServer();

  beforeEach(async () => {
    clearNodeTestSessionCookies();
    await loginAsSyntheticUser();
  });

  it("recibe_started_y_completed_en_orden_y_cierra_la_conexion", async () => {
    const submitted = await submitScan("10.0.0.30");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }

    const { events, statuses } = await subscribeUntilClosed(
      submitted.value.scanId,
    );

    expect(events.map((event) => event.status)).toEqual([
      "started",
      "completed",
    ]);
    expect(statuses[0]).toBe("connecting");
    expect(statuses).toContain("open");
    expect(statuses.at(-1)).toBe("closed");
  });

  it("un_escaneo_que_falla_termina_en_evento_failed", async () => {
    const submitted = await submitScan("10.0.0.fail");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }

    const { events } = await subscribeUntilClosed(submitted.value.scanId);

    expect(events.map((event) => event.status)).toEqual(["started", "failed"]);
  });

  it("un_scanId_ajeno_o_inexistente_termina_en_closed_sin_eventos", async () => {
    const { events, statuses } = await subscribeUntilClosed("no-existe");

    expect(events).toEqual([]);
    expect(statuses.at(-1)).toBe("closed");
  });

  it("un_corte_de_conexion_se_refleja_como_reconnecting_antes_de_reconectar", async () => {
    const submitted = await submitScan("10.0.0.disconnect");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }

    const { events, statuses } = await subscribeUntilClosed(
      submitted.value.scanId,
    );

    expect(statuses).toContain("reconnecting");
    expect(events.map((event) => event.status)).toEqual([
      "started",
      "completed",
    ]);
  }, 10_000);
});
