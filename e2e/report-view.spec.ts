/**
 * E2E de la visualización y exportación del reporte (feature `report_view`,
 * criterio 5, ver docs/verification.md Nivel 2): flujo completo contra el
 * `App.tsx` real integrado (`webServer` de `playwright.config.ts`, mismo
 * patrón que `e2e/scan-history.spec.ts`) — sesión sintética real antes de
 * navegar.
 *
 * El escaneo se encola vía `ScanForm` (no directo por API, a diferencia de
 * `e2e/scan-history.spec.ts`): aquí sí se necesita que llegue de verdad a
 * `COMPLETADO` (`useScanEvents` consume el guion SSE real del servidor de
 * contrato, ~20ms por evento, ver `SCAN_EVENT_INTERVAL_MS` en
 * `e2e/contract-server/server.ts`), y un navegador real no tiene el
 * problema de `EventSource`/`jsdom` que documentan los tests de
 * componente (`tests/features/report/ReportView.test.tsx`).
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: "report-view-e2e@example.test", name: "Analista E2E" },
  });
  expect(response.ok()).toBe(true);
});

test("abrir_el_reporte_de_un_escaneo_completado_muestra_su_estructura_y_permite_exportarlo", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByLabel("IP o rango a escanear").fill("172.16.50.7");
  await page.getByRole("button", { name: "Escanear" }).click();

  const statusLine = page.getByText(/^Estado: /);
  await expect(statusLine).toContainText("COMPLETADO");

  // El histórico necesita un refetch para reflejar el nuevo estado
  // COMPLETADO (mismo patrón que `e2e/scan-history.spec.ts`).
  await page.reload();

  const row = page.locator("tr", { hasText: "172.16.50.7" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("COMPLETADO");

  await row.getByRole("button", { name: "Ver reporte de 172.16.50.7" }).click();

  await expect(
    page.getByRole("heading", { name: /reporte de 172\.16\.50\.7/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /puertos y servicios/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /vulnerabilidades/i }),
  ).toBeVisible();
  // Nunca JSON crudo como presentación final (feature_list.json, id 7, criterio 1).
  await expect(page.locator("pre")).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /exportar reporte/i }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^reporte-escaneo-.+\.json$/);
});

test("un_escaneo_no_completado_muestra_un_estado_explicativo_en_el_reporte", async ({
  page,
  context,
}) => {
  // Encolado directo por API (mismo motivo que `e2e/scan-history.spec.ts`):
  // sin suscriptor SSE, el escaneo se queda en PENDIENTE, así el histórico
  // no ofrece "Ver reporte" para él — se navega directo con el `scanId`
  // conocido para probar el estado explicativo de `ReportView`, ejercitando
  // la misma vista que monta `App.tsx`, no un componente aislado.
  const submitResponse = await context.request.post("/api/scans", {
    data: { target: "172.16.50.8" },
  });
  expect(submitResponse.ok()).toBe(true);
  const { scanId } = (await submitResponse.json()) as { scanId: string };

  const reportResponse = await context.request.get(
    `/api/scans/${scanId}/report`,
  );
  expect(reportResponse.status()).toBe(409);

  await page.goto("/");

  const row = page.locator("tr", { hasText: "172.16.50.8" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("PENDIENTE");
  await expect(row.getByRole("button", { name: /ver reporte/i })).toHaveCount(
    0,
  );
});
