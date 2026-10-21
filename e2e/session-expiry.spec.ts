/**
 * E2E of the session-expiry notice (feature `resilient-error-handling`,
 * REH-03): an authenticated session whose next API call answers 401 lands
 * on the home page with a dismissible "Tu sesión expiró" notice, while a
 * first visit never shows it.
 */
import { expect, test } from "@playwright/test";

test("primera_visita_sin_sesion_no_muestra_el_aviso_de_expiracion", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("button", { name: "Iniciar sesión" }),
  ).toBeVisible();
  await expect(page.getByText("Tu sesión expiró")).toHaveCount(0);
});

test("un_401_en_una_sesion_activa_lleva_a_la_home_con_el_aviso_descartable", async ({
  context,
  page,
}) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: "expiry-e2e@example.test", name: "Analista E2E" },
  });
  expect(response.ok()).toBe(true);

  await page.route("**/api/network-credentials", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "text/plain",
      body: "sesión inválida o ausente",
    });
  });

  await page.goto("/");

  await expect(
    page.getByRole("status").filter({ hasText: "Tu sesión expiró" }),
  ).toContainText("Tu sesión expiró. Inicia sesión nuevamente.");
  await expect(
    page.getByRole("button", { name: "Iniciar sesión" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Cerrar aviso" }).click();
  await expect(page.getByText("Tu sesión expiró")).toHaveCount(0);
});
