/**
 * E2E de logout (feature `logout_button`, id 10): flujo completo contra el
 * `App.tsx` real integrado (`webServer` de `playwright.config.ts`, build de
 * producción servida por `vite preview`, proxeada al servidor de contrato
 * real) — mismo patrón que `e2e/scan-history.spec.ts`/
 * `e2e/network-credentials.spec.ts`: sesión sintética real antes de
 * navegar, clic real en la UI.
 *
 * `**\/auth/login` se intercepta igual que en el primer test de
 * `e2e/auth-session.spec.ts`: tanto el Gateway real como el servidor de
 * contrato responden ahí con un `302` hacia Google real, que este entorno
 * de test no puede completar (docs/security-scope.md prohíbe usar una
 * cuenta real). El criterio de aceptación ("termina mostrando el estado
 * anónimo") se verifica comprobando que, tras cerrar sesión, el navegador
 * efectivamente navega a esa ruta — que es exactamente lo que
 * `ProtectedRoute` hace en cuanto detecta `status === "anonymous"` (ver
 * `src/auth/ProtectedRoute.tsx`).
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  const response = await context.request.post("/__test__/session", {
    data: { email: "logout-e2e@example.test", name: "Analista E2E" },
  });
  expect(response.ok()).toBe(true);
});

test("clic_en_cerrar_sesion_termina_mostrando_el_estado_anonimo", async ({
  page,
}) => {
  let loginRequested = false;
  await page.route("**/auth/login", async (route) => {
    loginRequested = true;
    await route.fulfill({
      status: 200,
      contentType: "text/plain",
      body: "login stub (servidor de contrato, no Google real)",
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "front" })).toBeVisible();
  const logoutButton = page.getByRole("button", { name: "Cerrar sesión" });
  await expect(logoutButton).toBeVisible();

  await logoutButton.click();

  await page.waitForURL("**/auth/login");
  expect(loginRequested).toBe(true);
});
