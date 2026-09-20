/**
 * Servidor de contrato local: aproximación provisional al Gateway real
 * (que vive en el repo hermano `gateway`, aún no levantable aquí — ver
 * docs/verification.md, Nivel 2). Implementa la misma forma de API que
 * documenta `progress/explore_gateway_contract.md` (mismos endpoints,
 * códigos de estado, formato de evento SSE, y errores como texto plano),
 * usando únicamente `node:http` (sin frameworks nuevos, ver
 * `progress/explore_sse_contract_server.md` §4).
 *
 * Además de esos endpoints reales, expone dos rutas que el Gateway real
 * **no tiene**, documentadas explícitamente aquí para no confundirlas con
 * el contrato real:
 * - `POST /__test__/session`: crea una sesión sintética sin pasar por
 *   Google OIDC (docs/security-scope.md prohíbe usar una cuenta real de
 *   Google en tests). Solo existe en este servidor de contrato.
 * - `GET /api/scans/:scanId/report`: PROPUESTA de contrato para RF-11, no
 *   confirmada en el Gateway real (ver `../../src/api/report.ts` para la
 *   justificación completa) — se implementa aquí para poder testear
 *   `getReport` y la futura feature `report_view`.
 *
 * Este mismo servidor se reutiliza desde Vitest (arranque in-process en
 * puerto efímero, ver `tests/api/testServer.ts`) y desde Playwright
 * (`e2e/*.spec.ts`) — nunca se duplica un segundo servidor de test.
 */

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import type { MeResponse, ScanHistoryEntry } from "../../src/api/types";
import {
  applyEventToRecord,
  createScan,
  createStore,
  createSyntheticSession,
  findOwnedScan,
  type ContractServerStore,
  type ScanRecord,
} from "./store.ts";

const SESSION_COOKIE_NAME = "gateway_session";
const SCAN_EVENT_INTERVAL_MS = 20;

function writeText(res: ServerResponse, status: number, text: string): void {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function readSessionToken(req: IncomingMessage): string | undefined {
  const header = req.headers.cookie;
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key === SESSION_COOKIE_NAME) {
      return value;
    }
  }
  return undefined;
}

/**
 * Igual que el Gateway real: `401` texto plano genérico si la sesión está
 * ausente o no es válida (ver `progress/explore_gateway_contract.md` §5).
 */
function requireSessionToken(
  store: ContractServerStore,
  req: IncomingMessage,
  res: ServerResponse,
): string | undefined {
  const token = readSessionToken(req);
  if (!token || !store.sessions.has(token)) {
    writeText(res, 401, "sesión inválida o ausente");
    return undefined;
  }
  return token;
}

function toHistoryEntry(record: ScanRecord): ScanHistoryEntry {
  return {
    scanId: record.scanId,
    target: record.target,
    status: record.status,
    requested_at: record.requestedAt,
    updated_at: record.updatedAt,
  };
}

function handleTestCreateSession(
  store: ContractServerStore,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  void readRequestBody(req).then((bodyText) => {
    let identity: Partial<MeResponse> | undefined;
    if (bodyText.length > 0) {
      try {
        identity = JSON.parse(bodyText) as Partial<MeResponse>;
      } catch {
        writeText(res, 400, "cuerpo inválido: se esperaba JSON");
        return;
      }
    }
    const { token, profile } = createSyntheticSession(store, identity);
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Strict`,
    );
    writeJson(res, 200, profile);
  });
}

function handleGetMe(
  store: ContractServerStore,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const token = requireSessionToken(store, req, res);
  if (!token) {
    return;
  }
  const profile = store.sessions.get(token);
  if (!profile) {
    writeText(res, 401, "sesión inválida o ausente");
    return;
  }
  writeJson(res, 200, profile);
}

function handleGetScanHistory(
  store: ContractServerStore,
  req: IncomingMessage,
  res: ServerResponse,
): void {
  const token = requireSessionToken(store, req, res);
  if (!token) {
    return;
  }
  const entries = [...store.scans.values()]
    .filter((record) => record.sessionToken === token)
    .map(toHistoryEntry);
  writeJson(res, 200, entries);
}

async function handleSubmitScan(
  store: ContractServerStore,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const token = requireSessionToken(store, req, res);
  if (!token) {
    return;
  }
  const bodyText = await readRequestBody(req);
  let parsedBody: unknown;
  try {
    parsedBody = bodyText.length > 0 ? JSON.parse(bodyText) : undefined;
  } catch {
    writeText(res, 400, "target inválido: se esperaba JSON con { target }");
    return;
  }
  const target =
    typeof parsedBody === "object" &&
    parsedBody !== null &&
    "target" in parsedBody
      ? (parsedBody as Record<string, unknown>)["target"]
      : undefined;
  if (typeof target !== "string" || target.trim().length === 0) {
    writeText(
      res,
      400,
      "target inválido: se esperaba un string no vacío (IP o CIDR)",
    );
    return;
  }
  const record = createScan(store, token, target);
  writeJson(res, 200, { scanId: record.scanId });
}

function handleCancelScan(
  store: ContractServerStore,
  req: IncomingMessage,
  res: ServerResponse,
  scanId: string,
): void {
  const token = requireSessionToken(store, req, res);
  if (!token) {
    return;
  }
  const record = findOwnedScan(store, scanId, token);
  if (!record) {
    writeText(res, 404, "scan no encontrado");
    return;
  }
  if (record.status === "COMPLETADO" || record.status === "FALLIDO") {
    writeText(res, 409, "el escaneo ya está en un estado terminal");
    return;
  }
  record.status = "FALLIDO";
  record.updatedAt = new Date().toISOString();
  // Deja el guion consistente con la cancelación para cualquier suscriptor
  // SSE que siga escuchando (ver docs/architecture.md: RF-14 es una acción
  // aparte, pero el estado final debe reflejarse igual en tiempo real).
  record.script = record.script.slice(0, record.nextEventIndex).concat({
    status: "failed",
    correlation_id: record.scanId,
    reason: "cancelado por el usuario",
  });
  res.writeHead(202);
  res.end();
}

function handleGetReport(
  store: ContractServerStore,
  req: IncomingMessage,
  res: ServerResponse,
  scanId: string,
): void {
  const token = requireSessionToken(store, req, res);
  if (!token) {
    return;
  }
  const record = findOwnedScan(store, scanId, token);
  if (!record) {
    writeText(res, 404, "scan no encontrado");
    return;
  }
  if (record.status !== "COMPLETADO" || !record.result) {
    writeText(res, 409, "el escaneo aún no está completado");
    return;
  }
  writeJson(res, 200, record.result);
}

function handleScanEvents(
  store: ContractServerStore,
  req: IncomingMessage,
  res: ServerResponse,
  scanId: string,
): void {
  const token = requireSessionToken(store, req, res);
  if (!token) {
    return;
  }
  const record = findOwnedScan(store, scanId, token);
  if (!record) {
    writeText(res, 404, "scan no encontrado");
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  // Acelera los reintentos de EventSource en tests (el Gateway real no
  // manda `retry:` explícito, ver progress/explore_sse_contract_server.md §2.3).
  res.write("retry: 100\n\n");

  let stopped = false;
  const timer = setInterval(() => {
    if (stopped) {
      return;
    }
    if (record.nextEventIndex >= record.script.length) {
      stopped = true;
      clearInterval(timer);
      res.end();
      return;
    }
    const event = record.script[record.nextEventIndex];
    record.nextEventIndex += 1;
    applyEventToRecord(record, event);
    res.write(`data: ${JSON.stringify(event)}\n\n`);

    if (record.dropConnectionOnce) {
      record.dropConnectionOnce = false;
      stopped = true;
      clearInterval(timer);
      // `res.write` es asíncrono a nivel de socket: destruir la conexión en
      // el mismo tick puede tirar el evento recién escrito antes de que
      // llegue a la red. Un `setImmediate` alcanza para dejarlo salir y
      // simular igual un corte de conexión real a mitad de stream.
      setImmediate(() => res.destroy());
      return;
    }

    if (event.status === "completed" || event.status === "failed") {
      stopped = true;
      clearInterval(timer);
      res.end();
    }
  }, SCAN_EVENT_INTERVAL_MS);

  req.on("close", () => {
    stopped = true;
    clearInterval(timer);
  });
}

const SCAN_SUB_ROUTE = /^\/api\/scans\/([^/]+)\/(cancel|events|report)$/;

async function handleRequest(
  store: ContractServerStore,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://contract-server.local");
  const { pathname } = url;
  const method = req.method ?? "GET";

  if (method === "GET" && pathname === "/health") {
    writeText(res, 200, "ok");
    return;
  }

  if (method === "GET" && pathname === "/auth/login") {
    // El Gateway real hace 302 a Google OIDC; aquí no hay Google real que
    // completar el handshake (docs/security-scope.md prohíbe usar una
    // cuenta real), así que solo se replica el status/hoader para que
    // `loginRedirectUrl()` tenga algo real a lo que apuntar en e2e.
    res.writeHead(302, {
      Location: "https://accounts.google.com/o/oauth2/v2/auth?contract=1",
    });
    res.end();
    return;
  }

  if (method === "POST" && pathname === "/__test__/session") {
    handleTestCreateSession(store, req, res);
    return;
  }

  if (method === "GET" && pathname === "/api/me") {
    handleGetMe(store, req, res);
    return;
  }

  if (method === "GET" && pathname === "/api/scans") {
    handleGetScanHistory(store, req, res);
    return;
  }

  if (method === "POST" && pathname === "/api/scans") {
    await handleSubmitScan(store, req, res);
    return;
  }

  const scanSubMatch = SCAN_SUB_ROUTE.exec(pathname);
  if (scanSubMatch) {
    const [, scanId, action] = scanSubMatch;
    if (action === "cancel" && method === "POST") {
      handleCancelScan(store, req, res, scanId);
      return;
    }
    if (action === "events" && method === "GET") {
      handleScanEvents(store, req, res, scanId);
      return;
    }
    if (action === "report" && method === "GET") {
      handleGetReport(store, req, res, scanId);
      return;
    }
  }

  writeText(res, 404, "not found");
}

export interface RunningContractServer {
  url: string;
  close: () => Promise<void>;
}

export function startContractServer(port = 0): Promise<RunningContractServer> {
  const store = createStore();
  const server = createServer((req, res) => {
    handleRequest(store, req, res).catch((error: unknown) => {
      // Servidor de test, nunca llega a producción; se necesita
      // visibilidad de fallos inesperados del harness (docs/conventions.md).
      console.error("contract-server: error no manejado", error);
      if (!res.headersSent) {
        writeText(res, 500, "internal error (contract server)");
      } else {
        res.end();
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      const actualPort =
        typeof address === "object" && address !== null ? address.port : port;
      resolve({
        url: `http://127.0.0.1:${actualPort}`,
        close: () =>
          new Promise((resolveClose) => server.close(() => resolveClose())),
      });
    });
  });
}
