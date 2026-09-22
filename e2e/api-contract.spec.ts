/**
 * E2E del servidor de contrato (ver docs/verification.md, Nivel 2): lo
 * levanta como proceso real (no un mock de módulo) y ejercita `src/api`
 * contra él de punta a punta — login sintético, encolado, histórico,
 * cancelación, eventos SSE en tiempo real y el reporte propuesto (RF-11,
 * ver `src/api/report.ts` para la advertencia de que es especulativo).
 *
 * No navega ninguna página (`page.goto`) porque esta feature (`api_client`)
 * no incluye UI todavía — eso llega con `auth_session`/`scan_request_form`
 * y demás features, que reutilizarán este mismo servidor de contrato.
 */
import { expect, test } from "@playwright/test";

import { installNodeTestSessionSupport } from "./contract-server/nodeTestSession";
import {
  startContractServer,
  type RunningContractServer,
} from "./contract-server/server";
import {
  cancelScan,
  configureGatewayBaseUrl,
  getMe,
  getReport,
  getScanHistory,
  submitScan,
  subscribeToScanEvents,
  type ScanOutcomeEvent,
} from "../src/api";

installNodeTestSessionSupport();

let server: RunningContractServer;

test.beforeAll(async () => {
  server = await startContractServer(0);
  configureGatewayBaseUrl(server.url);
});

test.afterAll(async () => {
  await server.close();
  configureGatewayBaseUrl(undefined);
});

async function login(): Promise<void> {
  const response = await fetch(`${server.url}/__test__/session`, {
    method: "POST",
    credentials: "include",
  });
  expect(response.status).toBe(200);
}

test("flujo_completo_contra_el_servidor_de_contrato_real", async () => {
  await login();

  const me = await getMe();
  expect(me.ok).toBe(true);

  const submitted = await submitScan("172.16.0.1");
  expect(submitted.ok).toBe(true);
  if (!submitted.ok) {
    return;
  }

  const history = await getScanHistory();
  expect(history.ok).toBe(true);
  if (history.ok) {
    expect(
      history.value.some((entry) => entry.scanId === submitted.value.scanId),
    ).toBe(true);
  }

  const notReadyYet = await getReport(submitted.value.scanId);
  expect(notReadyYet).toEqual({ ok: false, error: { kind: "not_ready" } });

  const events: ScanOutcomeEvent[] = [];
  await new Promise<void>((resolve) => {
    subscribeToScanEvents(
      submitted.value.scanId,
      (event) => events.push(event),
      (status) => {
        if (status === "closed") {
          resolve();
        }
      },
    );
  });
  expect(events.map((event) => event.status)).toEqual(["started", "completed"]);

  const report = await getReport(submitted.value.scanId);
  expect(report.ok).toBe(true);
  if (report.ok) {
    expect(report.value.host).toBe("172.16.0.1");
  }

  const cancelResult = await cancelScan(submitted.value.scanId);
  expect(cancelResult).toEqual({
    ok: false,
    error: {
      kind: "conflict",
      message: "el escaneo ya está en un estado terminal",
    },
  });
});

test("cancelar_un_escaneo_pendiente_devuelve_202_y_luego_409", async () => {
  await login();

  const submitted = await submitScan("172.16.0.2");
  expect(submitted.ok).toBe(true);
  if (!submitted.ok) {
    return;
  }

  const firstCancel = await cancelScan(submitted.value.scanId);
  expect(firstCancel).toEqual({ ok: true, value: undefined });

  const secondCancel = await cancelScan(submitted.value.scanId);
  expect(secondCancel.ok).toBe(false);
  if (!secondCancel.ok) {
    expect(secondCancel.error.kind).toBe("conflict");
  }
});
