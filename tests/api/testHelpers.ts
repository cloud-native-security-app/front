/**
 * Helpers compartidos por los tests de `src/api`: arranque in-process del
 * servidor de contrato en un puerto efímero (nunca interceptando `fetch` a
 * nivel de módulo, ver docs/verification.md Nivel 1) y creación de
 * sesiones sintéticas de laboratorio (docs/security-scope.md: nunca una
 * cuenta real de Google).
 */

import { afterAll, beforeAll } from "vitest";

import {
  startContractServer,
  type RunningContractServer,
} from "../../e2e/contract-server/server";
import {
  configureGatewayBaseUrl,
  gatewayBaseUrl,
  type MeResponse,
} from "../../src/api";

/** Arranca el servidor de contrato antes de los tests del archivo y lo apaga al terminar. */
export function useContractServer(): void {
  let running: RunningContractServer | undefined;

  beforeAll(async () => {
    running = await startContractServer(0);
    configureGatewayBaseUrl(running.url);
  });

  afterAll(async () => {
    await running?.close();
    configureGatewayBaseUrl(undefined);
  });
}

/**
 * Crea una sesión sintética contra el endpoint de test del servidor de
 * contrato (`POST /__test__/session`, no existe en el Gateway real) y deja
 * la cookie resultante en el cookie jar de test — las siguientes llamadas
 * de `src/api` en el mismo test quedan autenticadas, igual que en un
 * navegador real tras completar el login delegado.
 */
export async function loginAsSyntheticUser(
  identity?: Partial<MeResponse>,
): Promise<MeResponse> {
  const response = await fetch(`${gatewayBaseUrl()}/__test__/session`, {
    method: "POST",
    credentials: "include",
    headers: identity ? { "Content-Type": "application/json" } : undefined,
    body: identity ? JSON.stringify(identity) : undefined,
  });
  return (await response.json()) as MeResponse;
}

export { clearNodeTestSessionCookies } from "../../e2e/contract-server/nodeTestSession";
