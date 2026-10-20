/**
 * Smoke test del scaffolding: verifica que el build de producción sirve la
 * SPA y monta React correctamente. Los flujos de negocio (login, escaneo,
 * histórico, reporte) se añaden junto con sus features respectivas contra
 * el servidor de contrato (ver docs/verification.md).
 *
 * Desde la feature `scan_request_form` (id 4), `App.tsx` real monta
 * `SessionProvider`/`ProtectedRoute` de verdad: sin sesión, `ProtectedRoute`
 * navega (`window.location.href`, redirección completa de navegador) a
 * `/auth/login`. Depender de ver el heading *antes* de que esa redirección
 * complete sería una carrera de timing no determinista, además de disparar
 * una navegación real hacia `accounts.google.com` en lo que se supone un
 * smoke test simple — se establece una sesión sintética real (mismo patrón
 * que `e2e/api-contract.spec.ts`/`e2e/auth-session.spec.ts`) antes de
 * navegar, así `ProtectedRoute` nunca redirige y la aserción del heading
 * (sin cambios) se cumple de forma determinista.
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  // `context.request` (no el `request` de nivel de test, que es un
  // `APIRequestContext` independiente sin cookies compartidas con `page`)
  // para que la cookie de sesión que fija el servidor de contrato viaje con
  // la navegación real de `page.goto("/")` de abajo.
  const response = await context.request.post("/__test__/session", {
    data: { email: "scaffolding-e2e@example.test", name: "Analista E2E" },
  });
  expect(response.ok()).toBe(true);
});

test("app_shell_mounts_and_renders_placeholder", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "front" })).toBeVisible();
});
