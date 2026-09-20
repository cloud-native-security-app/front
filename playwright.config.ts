/**
 * Configuración de Playwright para los tests end-to-end (ver
 * docs/verification.md, Nivel 2). Los flujos de negocio completos se
 * ejecutarán contra el servidor de contrato local (introducido en la
 * feature `api_client`, id 2); por ahora solo levanta el `preview` de
 * Vite para el smoke test del scaffolding.
 */
import { defineConfig } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run preview -- --port " + PORT + " --strictPort",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env["CI"],
  },
});
