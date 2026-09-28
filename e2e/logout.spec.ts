/**
 * E2E de logout (feature `logout_button`, id 10): flujo completo contra el
 * `App.tsx` real integrado (`webServer` de `playwright.config.ts`, build de
 * producción servida por `vite preview`, proxeada al servidor de contrato
 * real) — mismo patrón que `e2e/scan-history.spec.ts`/
 * `e2e/network-credentials.spec.ts`: sesión sintética real antes de
 * navegar, clic real en la UI.
 *
 * Ajuste (feature `home_landing_page`, id 12): antes, `ProtectedRoute`
 * navegaba automáticamente a `/auth/login` en cuanto detectaba
 * `status === "anonymous"`, así que este test verificaba "termina
 * mostrando el estado anónimo" comprobando esa navegación automática. Ahora
 * `ProtectedRoute` renderiza `HomePage` como `anonymousView` en vez de
 * redirigir sola — `LogoutButton` sigue navegando a `/` (sin cambios, ver
 * `src/auth/LogoutButton.tsx`), y es justo ahí, en la propia raíz, donde
 * ahora se ve el estado anónimo (la página de inicio con su CTA), no en
 * `/auth/login`. El criterio de aceptación no cambia ("termina mostrando el
 * estado anónimo"), solo el mecanismo con el que se verifica.
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
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "front" })).toBeVisible();
  const logoutButton = page.getByRole("button", { name: "Cerrar sesión" });
  await expect(logoutButton).toBeVisible();

  await logoutButton.click();

  await page.waitForURL("/");
  await expect(
    page.getByRole("heading", {
      name: "Analiza infraestructura antes de que alguien más lo haga.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Iniciar sesión" }),
  ).toBeVisible();
});
