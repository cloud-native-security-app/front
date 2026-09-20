/**
 * Smoke test del scaffolding: verifica que el build de producción sirve la
 * SPA y monta React correctamente. Los flujos de negocio (login, escaneo,
 * histórico, reporte) se añaden junto con sus features respectivas contra
 * el servidor de contrato (ver docs/verification.md).
 */
import { expect, test } from "@playwright/test";

test("app_shell_mounts_and_renders_placeholder", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "front" })).toBeVisible();
});
