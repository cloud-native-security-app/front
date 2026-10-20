/**
 * E2E del histórico de escaneos y cancelación (feature `scan_history`,
 * criterio 5): flujo completo contra el `App.tsx` real integrado
 * (`webServer` de `playwright.config.ts`, mismo patrón que
 * `e2e/scan-request-form.spec.ts`/`e2e/realtime-status.spec.ts`) — sesión
 * sintética real antes de navegar.
 *
 * El escaneo a cancelar se encola con `context.request.post("/api/scans")`
 * directamente (mismo origen, misma cookie de sesión que la página, ver
 * `playwright.config.ts`) en vez de a través del formulario de la UI: si
 * se encolara vía `ScanForm`, `useScanEvents` abriría de inmediato una
 * suscripción SSE para ese `scanId`, y el guion del servidor de contrato
 * (`SCAN_EVENT_INTERVAL_MS` de `e2e/contract-server/server.ts`, ~20ms por
 * evento) lo llevaría a `COMPLETADO` casi de inmediato — dejando una
 * ventana demasiado angosta y no determinista para alcanzar a cancelarlo
 * en `PENDIENTE`. Encolándolo directo por API nadie se suscribe a sus
 * eventos, así que se queda en `PENDIENTE` hasta que el test lo cancela.
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: "scan-history-e2e@example.test", name: "Analista E2E" },
  });
  expect(response.ok()).toBe(true);
});

test("cancelar_un_escaneo_en_curso_refleja_el_nuevo_estado_sin_recargar_la_pagina", async ({
  page,
  context,
}) => {
  const submitResponse = await context.request.post("/api/scans", {
    data: { target: "172.16.40.9" },
  });
  expect(submitResponse.ok()).toBe(true);

  await page.goto("/");

  const row = page.locator("tr", { hasText: "172.16.40.9" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("PENDIENTE");

  await row
    .getByRole("button", { name: "Cancelar escaneo de 172.16.40.9" })
    .click();

  await expect(row).toContainText("FALLIDO");
  await expect(
    row.getByRole("button", { name: "Cancelar escaneo de 172.16.40.9" }),
  ).toHaveCount(0);
});

test("un_escaneo_completado_no_muestra_accion_de_cancelar_en_el_historico", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByLabel("IP o rango a escanear").fill("172.16.41.5");
  await page.getByRole("button", { name: "Escanear" }).click();
  await expect(page.getByText(/escaneo encolado\. id: /i)).toBeVisible();

  // El escaneo encolado vía el formulario sí abre una suscripción SSE
  // (`useScanEvents`) y llega a `COMPLETADO` en el guion del servidor de
  // contrato (ver comentario de cabecera de este archivo).
  const statusLine = page.getByText(/^Estado: /);
  await expect(statusLine).toContainText("COMPLETADO");

  await page.reload();

  const row = page.locator("tr", { hasText: "172.16.41.5" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("COMPLETADO");
  await expect(row.getByRole("button", { name: /cancelar/i })).toHaveCount(0);
});
