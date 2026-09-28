/**
 * E2E de la página de inicio (feature `home_landing_page`, id 12): contra
 * el `App.tsx` real integrado (`webServer` de `playwright.config.ts`, build
 * de producción servida por `vite preview`, proxeada al servidor de
 * contrato real) — mismo patrón que `e2e/logout.spec.ts`/
 * `e2e/scaffolding.spec.ts`. Sin sesión (a diferencia de esos dos, aquí no
 * se crea una sesión sintética antes de navegar: es justamente el flujo
 * del visitante anónimo el que se ejercita).
 *
 * `**\/auth/login` se intercepta igual que en `e2e/auth-session.spec.ts`:
 * tanto el Gateway real como el servidor de contrato responden ahí con un
 * `302` hacia Google real, que este entorno de test no puede completar
 * (docs/security-scope.md prohíbe usar una cuenta real).
 */
import { expect, test } from "@playwright/test";

test("visitante_sin_sesion_ve_la_pagina_de_inicio_y_el_cta_navega_a_login", async ({
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

  const cspViolations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) {
      cspViolations.push(message.text());
    }
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Analiza infraestructura antes de que alguien más lo haga.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Escaneo en vivo")).toBeVisible();
  await expect(
    page.getByText(
      "Verificar — estado en tiempo real, sin recargar la página.",
    ),
  ).toBeVisible();

  const cta = page.getByRole("button", { name: "Iniciar sesión" });
  await expect(cta).toBeVisible();
  await cta.click();

  await page.waitForURL("**/auth/login");
  expect(loginRequested).toBe(true);

  // Las fuentes self-hosted (`@fontsource/space-grotesk`,
  // `@fontsource/ibm-plex-mono`) deben cargar bajo la CSP real de
  // `nginx.conf.template` sin violaciones — aquí se sirven vía `vite
  // preview` (sin la CSP de nginx), así que esta aserción cubre errores de
  // carga en general; la ausencia de violaciones de CSP con las fuentes
  // reales se verifica manualmente contra la imagen de `containerization`
  // (ver `progress/impl_home_landing_page.md`).
  expect(cspViolations).toEqual([]);
});
