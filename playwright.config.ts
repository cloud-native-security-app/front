/**
 * Configuración de Playwright para los tests end-to-end (ver
 * docs/verification.md, Nivel 2). Levanta dos procesos reales: el
 * servidor de contrato (`e2e/contract-server/`, puerto fijo conocido) y el
 * `preview` de Vite de la SPA compilada, con `VITE_GATEWAY_BASE_URL`
 * apuntando al propio origen del preview — `vite.config.ts` proxea
 * `/api`/`/auth`/`/__test__` desde ahí hacia el servidor de contrato, así
 * las llamadas de `src/api` quedan en el mismo origen que la página
 * (evita el problema de cookies/CORS cross-origin al probar sesión real
 * en un navegador, ver progress/impl_scan_request_form.md). El comando de
 * preview reconstruye (`npm run build`) antes de servir, para que el
 * `dist/` servido refleje siempre el código fuente actual y no una build
 * previa ya obsoleta (`init.sh` corre `test:e2e` antes de `build`).
 */
import { defineConfig } from "@playwright/test";

const PORT = 4173;
const CONTRACT_SERVER_PORT = 4310; // debe coincidir con vite.config.ts

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "node e2e/contract-server/main.ts",
      url: `http://127.0.0.1:${CONTRACT_SERVER_PORT}/health`,
      reuseExistingServer: !process.env["CI"],
      env: { CONTRACT_SERVER_PORT: String(CONTRACT_SERVER_PORT) },
    },
    {
      command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !process.env["CI"],
      env: {
        VITE_GATEWAY_BASE_URL: `http://localhost:${PORT}`,
        CONTRACT_SERVER_PORT: String(CONTRACT_SERVER_PORT),
      },
    },
  ],
});
