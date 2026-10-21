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

import { seedTarget } from "./seedTarget";

test.beforeEach(async ({ context }) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: "report-view-e2e@example.test", name: "Analista E2E" },
  });
  expect(response.ok()).toBe(true);
});

test("abrir_el_reporte_de_un_escaneo_completado_muestra_su_estructura_y_permite_exportarlo", async ({
  page,
  context,
}) => {
  await seedTarget(context, "172.16.50.7");
  await page.goto("/");

  await page.getByLabel("Objetivo a escanear").selectOption("172.16.50.7");
  await page.getByRole("button", { name: "Escanear" }).click();

  const statusLine = page.getByText(/^Estado: /);
  await expect(statusLine).toContainText("Completado");

  // Historial loads fresh on navigation and shows the finished scan.
  await page.getByRole("link", { name: "Historial" }).click();

  const row = page.locator("tr", { hasText: "172.16.50.7" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Completado");

  await row.getByRole("button", { name: "Ver reporte de 172.16.50.7" }).click();

  const reportHeading = page.getByRole("heading", {
    name: /reporte de 172\.16\.50\.7/i,
  });
  await expect(reportHeading).toBeVisible();
  await expect(reportHeading).toBeFocused();
  await expect(page).toHaveURL(/\/historial\/.+/);
  await expect(
    page.getByRole("heading", { name: /puertos y servicios/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /vulnerabilidades/i }),
  ).toBeVisible();
  await expect(page.getByText("Confirmada")).toHaveCount(1);
  await expect(page.getByText("Posible (según versión)").first()).toBeVisible();
  await expect(page.getByText(/Amazon Linux o RHEL/)).toHaveCount(1);
  // Nunca JSON crudo como presentación final (`docs/decisions.md`).
  await expect(page.locator("pre")).toHaveCount(0);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /exportar reporte/i }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^reporte-escaneo-.+\.json$/);

  await page.getByRole("link", { name: "Volver al historial" }).click();
  await expect(page).toHaveURL(/\/historial$/);
  await expect(page.locator("tr", { hasText: "172.16.50.7" })).toBeVisible();
});

test("un_escaneo_fallido_muestra_su_motivo_en_el_historial", async ({
  page,
  context,
}) => {
  // Queued through the API and drained through the SSE endpoint so the
  // contract server reaches the terminal `failed` outcome ("fail" in the
  // target selects it).
  const submitResponse = await context.request.post("/api/scans", {
    data: { target: "172.16.50.fail" },
  });
  expect(submitResponse.ok()).toBe(true);
  const { scanId } = (await submitResponse.json()) as { scanId: string };
  await context.request.get(`/api/scans/${scanId}/events`);

  await page.goto("/historial");
  const row = page.locator("tr", { hasText: "172.16.50.fail" });
  await expect(row).toContainText("Falló");
  await expect(row).toContainText("Motivo: objetivo inalcanzable");
});
