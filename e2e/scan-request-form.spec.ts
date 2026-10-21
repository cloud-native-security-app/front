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

import { seedTarget } from "./seedTarget";

test.beforeEach(async ({ context }) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: "scan-form-e2e@example.test", name: "Analista E2E" },
  });
  expect(response.ok()).toBe(true);
});

test("elegir_un_objetivo_guardado_y_ver_el_aviso_de_escaneo_en_cola", async ({
  page,
  context,
}) => {
  await seedTarget(context, "172.16.10.5");
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Security Scan App" }),
  ).toBeVisible();

  await page.getByLabel("Objetivo a escanear").selectOption("172.16.10.5");
  await page.getByRole("button", { name: "Escanear" }).click();

  await expect(page.getByText(/escaneo en cola/i)).toBeVisible();
});

test("un_objetivo_sin_credencial_explica_que_hay_que_agregar_una", async ({
  page,
  context,
}) => {
  await seedTarget(context, "203.0.113.99");
  await page.goto("/");

  // 203.0.113.99 es el objetivo "sin credencial" del servidor de contrato (422).
  await page.getByLabel("Objetivo a escanear").selectOption("203.0.113.99");
  await page.getByRole("button", { name: "Escanear" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toHaveText(
    "Primero agrega una credencial de red para esa IP.",
  );
  await expect(alert).not.toContainText(/gateway/i);
});

test("la_pestana_y_la_cabecera_usan_el_nombre_del_producto", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle(
    "Security Scan App · Escaneo de vulnerabilidades",
  );
});
