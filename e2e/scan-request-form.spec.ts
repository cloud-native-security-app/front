/**
 * E2E del formulario de nueva solicitud de escaneo (feature
 * `scan_request_form`, criterio 7, ver docs/verification.md Nivel 2):
 * flujo completo contra el `App.tsx` real integrado (`webServer` de
 * `playwright.config.ts`, build de producción servido por `vite preview`,
 * proxeado al servidor de contrato real) — sesión sintética real antes de
 * navegar para pasar el `ProtectedRoute` (mismo patrón que
 * `e2e/scaffolding.spec.ts`, ver comentario ahí para el porqué).
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: "scan-form-e2e@example.test", name: "Analista E2E" },
  });
  expect(response.ok()).toBe(true);
});

test("ingresar_una_ip_valida_y_ver_el_scanId_en_pantalla", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "front" })).toBeVisible();

  await page.getByLabel("IP o rango a escanear").fill("172.16.10.5");
  await page.getByRole("button", { name: "Escanear" }).click();

  await expect(page.getByRole("status")).toContainText(
    /escaneo encolado\. id: .+/i,
  );
});
