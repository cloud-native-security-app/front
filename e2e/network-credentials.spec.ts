/**
 * E2E de gestión de credenciales de red (feature
 * `network_credentials_manager`, id 9): flujo completo contra el `App.tsx`
 * real integrado (`webServer` de `playwright.config.ts`), mismo patrón que
 * `e2e/scan-request-form.spec.ts` — sesión sintética real antes de navegar.
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  const response = await context.request.post("/__test__/session", {
    data: {
      email: "network-credentials-e2e@example.test",
      name: "Analista E2E",
    },
  });
  expect(response.ok()).toBe(true);
});

test("crear_una_credencial_verla_en_el_listado_y_borrarla", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "front" })).toBeVisible();
  await expect(
    page.getByText(/todavía no hay credenciales de red configuradas/i),
  ).toBeVisible();

  await page.getByLabel("IP o rango del objetivo").fill("172.20.10.5");
  await page.getByLabel("Usuario de red").fill("root");
  await page.getByLabel("Credencial SSH").fill("vault://ssh/e2e-lab-key");
  await page.getByRole("button", { name: "Agregar credencial" }).click();

  const row = page.locator("tr", { hasText: "172.20.10.5" });
  await expect(row).toBeVisible();
  await expect(row).toContainText("root");
  await expect(row).toContainText("No");

  // La credencial SSH real nunca vuelve del Gateway (docs/security-scope.md):
  // no debe aparecer en ningún lugar de la página, ni en el listado.
  await expect(page.locator("body")).not.toContainText(
    "vault://ssh/e2e-lab-key",
  );

  await row
    .getByRole("button", { name: "Borrar credencial de 172.20.10.5" })
    .click();

  await expect(row).toHaveCount(0);
  await expect(
    page.getByText(/todavía no hay credenciales de red configuradas/i),
  ).toBeVisible();
});
