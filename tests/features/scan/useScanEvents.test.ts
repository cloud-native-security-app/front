// @vitest-environment node
//
// Corre en el entorno "node" por el mismo motivo que
// `tests/api/scanEvents.test.ts` (ver el comentario de cabecera de ese
// archivo): el polyfill de `EventSource` de `undici`
// (`e2e/contract-server/nodeTestSession.ts`) es incompatible con `jsdom` —
// confirmado en esta sesión: en cuanto la conexión recibe cualquier
// respuesta real, el `Event` global reemplazado por `jsdom` hace que el
// `dispatchEvent` nativo de Node rechace el evento
// (`TypeError: The "event" argument must be an instance of Event`), y esa
// referencia nativa a `Event` no queda accesible desde ningún código de
// test una vez sobrescrita. Por esa misma razón, `@testing-library/react`
// tampoco puede usarse aquí (`render()` requiere `document`, inexistente en
// este entorno) — no existe una combinación de este stack de testing que
// permita renderizar un componente de React Y ejercer un `EventSource`
// real en el mismo test.
//
// Por eso este archivo prueba directamente la lógica que `useScanEvents`
// envuelve (`scanOutcomeEventToStatus` + `subscribeToScanEvents`, la misma
// función real usada dentro del hook, nunca mockeada) contra el servidor de
// contrato real, en vez de montar el hook vía `render`/`renderHook`. El
// wiring de React (`useState`/`useEffect` dentro de `useScanEvents`) es
// trivial y se verifica de punta a punta contra un navegador real en
// `e2e/realtime-status.spec.ts`.
import { beforeEach, describe, expect, it } from "vitest";

import { submitScan, subscribeToScanEvents } from "../../../src/api";
import type { ConnectionStatus, ScanOutcomeEvent } from "../../../src/api";
import {
  scanOutcomeEventToStatus,
  type ScanEventsState,
} from "../../../src/features/scan";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../../api/testHelpers";

/**
 * Reproduce exactamente la reducción de estado que hace `useScanEvents`
 * dentro de su `useEffect` (mismo `scanOutcomeEventToStatus`, mismo
 * `subscribeToScanEvents`), para poder verificarla sin necesitar
 * renderizar un componente real.
 */
function watchScanEventsUntilClosed(scanId: string): Promise<{
  snapshots: ScanEventsState[];
  connectionStatuses: ConnectionStatus[];
}> {
  const snapshots: ScanEventsState[] = [];
  const connectionStatuses: ConnectionStatus[] = [];
  let current: ScanEventsState = {
    status: "PENDIENTE",
    connectionStatus: "connecting",
  };

  return new Promise((resolve) => {
    subscribeToScanEvents(
      scanId,
      (event: ScanOutcomeEvent) => {
        current = { ...current, status: scanOutcomeEventToStatus(event) };
        snapshots.push(current);
      },
      (connectionStatus) => {
        current = { ...current, connectionStatus };
        connectionStatuses.push(connectionStatus);
        snapshots.push(current);
        if (connectionStatus === "closed") {
          resolve({ snapshots, connectionStatuses });
        }
      },
    );
  });
}

function dedupeConsecutive<T>(values: T[]): T[] {
  return values.filter((value, index) => value !== values[index - 1]);
}

describe("scanOutcomeEventToStatus", () => {
  it("traduce_started_completed_failed_al_vocabulario_del_historico_rest", () => {
    expect(
      scanOutcomeEventToStatus({ status: "started", correlation_id: "c-1" }),
    ).toBe("EN_PROGRESO");
    expect(
      scanOutcomeEventToStatus({
        status: "completed",
        correlation_id: "c-1",
        result: {
          host: "10.0.0.1",
          ports: [],
          vulnerabilities: [],
          scanned_at: new Date().toISOString(),
        },
      }),
    ).toBe("COMPLETADO");
    expect(
      scanOutcomeEventToStatus({
        status: "failed",
        correlation_id: "c-1",
        reason: "motivo simulado",
      }),
    ).toBe("FALLIDO");
  });
});

describe("useScanEvents (lógica de reducción real, sin mocks)", () => {
  useContractServer();

  beforeEach(async () => {
    clearNodeTestSessionCookies();
    await loginAsSyntheticUser();
  });

  it("refleja_pendiente_en_progreso_y_completado_en_orden_hasta_el_estado_terminal", async () => {
    const submitted = await submitScan("10.0.1.30");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }

    const { snapshots } = await watchScanEventsUntilClosed(
      submitted.value.scanId,
    );

    const distinctStatusSequence = dedupeConsecutive(
      snapshots.map((snapshot) => snapshot.status),
    );
    expect(distinctStatusSequence).toEqual([
      "PENDIENTE",
      "EN_PROGRESO",
      "COMPLETADO",
    ]);
    expect(snapshots.at(-1)).toEqual({
      status: "COMPLETADO",
      connectionStatus: "closed",
    });
  });

  it("un_escaneo_que_falla_termina_en_fallido", async () => {
    const submitted = await submitScan("10.0.1.fail");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }

    const { snapshots } = await watchScanEventsUntilClosed(
      submitted.value.scanId,
    );

    const distinctStatusSequence = dedupeConsecutive(
      snapshots.map((snapshot) => snapshot.status),
    );
    expect(distinctStatusSequence).toEqual([
      "PENDIENTE",
      "EN_PROGRESO",
      "FALLIDO",
    ]);
    expect(snapshots.at(-1)).toEqual({
      status: "FALLIDO",
      connectionStatus: "closed",
    });
  });

  it("un_corte_de_conexion_expone_reconnecting_de_forma_visible_antes_de_completar", async () => {
    const submitted = await submitScan("10.0.1.disconnect");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }

    const { connectionStatuses, snapshots } = await watchScanEventsUntilClosed(
      submitted.value.scanId,
    );

    expect(connectionStatuses).toContain("reconnecting");
    expect(snapshots.map((snapshot) => snapshot.status)).toContain(
      "COMPLETADO",
    );
  }, 10_000);
});
