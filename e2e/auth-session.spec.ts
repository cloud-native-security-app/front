/**
 * E2E de sesión y rutas protegidas (feature `auth_session`, ver
 * docs/verification.md, Nivel 2): levanta el servidor de contrato real
 * (igual que `e2e/api-contract.spec.ts`) y, además, un servidor Vite de
 * desarrollo **programático** (API pública de `vite`, sin tocar
 * `vite.config.ts`/`playwright.config.ts`/`package.json`) que sirve el
 * harness de `./authHarness` — un montaje mínimo de los componentes REALES
 * de `src/auth` — con `server.proxy` reenviando `/api`, `/auth` y
 * `/__test__` al servidor de contrato.
 *
 * ¿Por qué no el `webServer` de `playwright.config.ts`? Ese sirve el build
 * estático de producción (`vite preview`) sin `VITE_GATEWAY_BASE_URL`
 * configurada — es lo que usa `e2e/scaffolding.spec.ts` (feature
 * `scaffolding`, ya `done`), y esta feature necesita una URL de Gateway
 * dinámica (el puerto efímero del servidor de contrato) que solo se conoce
 * en tiempo de test. Levantar un segundo servidor aquí, en vez de tocar la
 * config compartida, evita romper el smoke test de esa otra feature (ver
 * `progress/impl_auth_session.md` para la decisión completa de por qué
 * `src/App.tsx`/`src/main.tsx` de producción no se integran todavía con
 * `src/auth`).
 *
 * El proxy (en vez de CORS) mantiene el harness y el Gateway bajo el mismo
 * origen desde la perspectiva del navegador, tal como ocurrirá en
 * producción (front y Gateway detrás del mismo dominio, ver
 * docs/architecture.md) — así la cookie `HttpOnly` de sesión funciona
 * exactamente igual que en un navegador real, sin necesitar cabeceras CORS
 * en el servidor de contrato (fuera del alcance de esta feature).
 */
import { createServer as createNetServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";
import { createServer as createViteServer, type ViteDevServer } from "vite";

import {
  startContractServer,
  type RunningContractServer,
} from "./contract-server/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const VITE_GATEWAY_BASE_URL_KEY = "VITE_GATEWAY_BASE_URL";

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port =
        typeof address === "object" && address !== null ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

let contractServer: RunningContractServer;
let viteServer: ViteDevServer;
let harnessOrigin: string;
let harnessUrl: string;

test.beforeAll(async () => {
  contractServer = await startContractServer(0);

  const harnessPort = await getFreePort();
  harnessOrigin = `http://127.0.0.1:${harnessPort}`;
  harnessUrl = `${harnessOrigin}/e2e/authHarness/index.html`;

  // `import.meta.env.VITE_GATEWAY_BASE_URL` se resuelve a partir de
  // `process.env` en el momento en que Vite arranca (ver
  // `src/api/config.ts`) — se fija aquí, antes de `createViteServer`, para
  // que el harness apunte a su propio origen (el proxy de abajo reenvía al
  // servidor de contrato real).
  process.env[VITE_GATEWAY_BASE_URL_KEY] = harnessOrigin;

  viteServer = await createViteServer({
    root: PROJECT_ROOT,
    configFile: path.join(PROJECT_ROOT, "vite.config.ts"),
    logLevel: "warn",
    server: {
      host: "127.0.0.1",
      port: harnessPort,
      strictPort: true,
      proxy: {
        "/api": { target: contractServer.url, changeOrigin: true },
        "/auth": { target: contractServer.url, changeOrigin: true },
        "/__test__": { target: contractServer.url, changeOrigin: true },
      },
    },
  });
  await viteServer.listen();
});

test.afterAll(async () => {
  await viteServer.close();
  await contractServer.close();
  delete process.env[VITE_GATEWAY_BASE_URL_KEY];
});

// Ajuste (feature `home_landing_page`, id 12): antes, un visitante sin
// sesión era redirigido de inmediato (`window.location.href`) sin ver
// contenido — este test verificaba esa asignación. Ahora `ProtectedRoute`
// renderiza `HomePage` como `anonymousView` (ver `../authHarness/main.tsx`)
// en vez de rebotar en silencio: el test se renombra para reflejar el
// comportamiento real y confirma la página de inicio antes del clic en su
// CTA, no una redirección automática. Sigue usando `page.route` (mismo
// patrón ya presente en este archivo) para no depender de una red real
// hacia Google.
test("usuario_sin_sesion_ve_la_pagina_de_inicio_y_puede_ir_a_login", async ({
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

  await page.goto(harnessUrl);

  await expect(
    page.getByRole("heading", {
      name: "Analiza infraestructura antes de que alguien más lo haga.",
    }),
  ).toBeVisible();
  const cta = page.getByRole("button", { name: "Iniciar sesión" });
  await expect(cta).toBeVisible();
  await expect(page.getByText("Contenido protegido")).toHaveCount(0);

  await cta.click();

  await page.waitForURL(`${harnessOrigin}/auth/login`);
  expect(loginRequested).toBe(true);
});

test("usuario_con_sesion_ve_el_contenido_protegido", async ({
  page,
  context,
}) => {
  const sessionResponse = await context.request.post(
    `${harnessOrigin}/__test__/session`,
    { data: { email: "auth-e2e@example.test", name: "Analista E2E" } },
  );
  expect(sessionResponse.ok()).toBe(true);

  await page.goto(harnessUrl);

  await expect(
    page.getByRole("heading", { name: "Contenido protegido" }),
  ).toBeVisible();
  await expect(page.getByText("auth-e2e@example.test")).toBeVisible();
});
