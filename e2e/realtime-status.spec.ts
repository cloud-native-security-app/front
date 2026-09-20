/**
 * E2E del estado de escaneo en tiempo real (feature `realtime_status`,
 * criterios 2/5): flujo completo contra el `App.tsx` real integrado
 * (`webServer` de `playwright.config.ts`, mismo patrón que
 * `e2e/scan-request-form.spec.ts`) — sesión sintética real antes de
 * navegar. En un navegador real, `EventSource` es nativo (sin el problema
 * de `jsdom`/`undici` que documentan `tests/features/scan/ScanForm.test.tsx`
 * y `tests/features/scan/useScanEvents.test.ts`), así que aquí sí se
 * ejerce el flujo completo de punta a punta: encolar y llegar al estado
 * terminal (`COMPLETADO`) sin recargar la página.
 *
 * Las convenciones del servidor de contrato para forzar `failed` (target
 * que contiene "fail") o un corte de conexión (target que contiene
 * "disconnect", ver `e2e/contract-server/store.ts`) no son alcanzables
 * desde este spec: `validateScanTarget` (feature `scan_request_form`)
 * exige octetos IPv4 numéricos, así que ningún target con esas palabras
 * puede llegar siquiera a habilitar el botón "Escanear" en la UI real. Esos
 * dos escenarios (secuencia hasta `failed`, y `reconnecting` visible ante
 * un corte de conexión) se verifican sin mocks contra el servidor de
 * contrato real en `tests/features/scan/useScanEvents.test.ts`, llamando
 * directamente a `submitScan`/`subscribeToScanEvents` (la misma función que
 * usa `useScanEvents`), ya que ahí sí se puede pasar un target arbitrario
 * sin pasar por el formulario.
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: "realtime-status-e2e@example.test", name: "Analista E2E" },
  });
  expect(response.ok()).toBe(true);
});

test("un_escaneo_exitoso_llega_al_estado_completado_sin_recargar_la_pagina", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByLabel("IP o rango a escanear").fill("172.16.20.5");
  await page.getByRole("button", { name: "Escanear" }).click();

  await expect(page.getByText(/escaneo encolado\. id: /i)).toBeVisible();

  // No se asevera sobre los estados intermedios (`PENDIENTE`/`EN_PROGRESO`):
  // el servidor de contrato emite todo el guion (`started` -> `completed`)
  // en ~20ms (`SCAN_EVENT_INTERVAL_MS` en `e2e/contract-server/server.ts`),
  // una ventana demasiado corta para que aserciones de UI con polling los
  // capturen de forma confiable (confirmado empíricamente en esta sesión:
  // el navegador real puede pasar de `PENDIENTE` a `COMPLETADO` sin que
  // Playwright llegue a leer `EN_PROGRESO` en medio). La secuencia completa
  // y en orden (`PENDIENTE` -> `EN_PROGRESO` -> `COMPLETADO`, sin saltos) ya
  // se verifica con instrumentación precisa (sin polling, cada callback de
  // `subscribeToScanEvents` capturado directamente) en
  // `tests/features/scan/useScanEvents.test.ts`. Este spec e2e confirma lo
  // que sí es exclusivo de un navegador real: que la UI llega al estado
  // terminal correcto sin recargar la página.
  const statusLine = page.getByText(/^Estado: /);
  await expect(statusLine).toContainText("COMPLETADO");
});
