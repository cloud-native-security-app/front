/**
 * Punto de entrada para levantar el servidor de contrato como proceso
 * independiente (p. ej. `node e2e/contract-server/main.ts`, o desde un
 * futuro `webServer` de `playwright.config.ts` cuando una feature que
 * dirija la SPA completa contra él lo requiera — fuera del alcance de
 * `api_client`, que solo entrega el servidor y su arranque in-process).
 *
 * Puerto configurable vía `CONTRACT_SERVER_PORT` (por defecto 4310, fijo y
 * fuera del rango que usa `vite preview`/`playwright.config.ts`).
 */

import { startContractServer } from "./server";

const port = Number(process.env["CONTRACT_SERVER_PORT"] ?? "4310");

startContractServer(port)
  .then(({ url }) => {
    // Proceso de servidor standalone (nunca código de producción de la
    // SPA): `console.log`/`console.error` deliberados son aceptables aquí
    // (docs/conventions.md).
    console.log(`contract-server escuchando en ${url}`);
  })
  .catch((error: unknown) => {
    console.error("contract-server: no se pudo iniciar", error);
    process.exitCode = 1;
  });
