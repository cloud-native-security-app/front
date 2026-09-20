/**
 * Configuración de build/dev-server de Vite (ver docs/architecture.md).
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const CONTRACT_SERVER_PORT = Number(
  process.env["CONTRACT_SERVER_PORT"] ?? "4310",
);

/**
 * Proxy hacia el servidor de contrato local (`e2e/contract-server/`),
 * usado por `npm run dev`/`npm run preview` solo en desarrollo local y en
 * los tests e2e (ver docs/verification.md) — deja las llamadas de
 * `src/api` en el mismo origen que la propia SPA, evitando el problema de
 * CORS/cookies cross-origin al probar sesión real contra un servidor
 * aparte (ver progress/impl_scan_request_form.md para el porqué). Nunca se
 * usa en la imagen de despliegue real (feature `containerization`, que
 * sirve assets estáticos detrás de un proxy real hacia el Gateway) ni
 * afecta a un `VITE_GATEWAY_BASE_URL` absoluto que apunte a un Gateway
 * real: el proxy solo intercepta peticiones hechas al propio origen del
 * dev-server/preview.
 */
const contractServerProxy = {
  "/api": `http://127.0.0.1:${CONTRACT_SERVER_PORT}`,
  "/auth": `http://127.0.0.1:${CONTRACT_SERVER_PORT}`,
  "/__test__": `http://127.0.0.1:${CONTRACT_SERVER_PORT}`,
};

export default defineConfig({
  plugins: [react()],
  server: { proxy: contractServerProxy },
  preview: { proxy: contractServerProxy },
});
