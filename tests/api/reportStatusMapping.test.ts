// @vitest-environment node
/**
 * `getReport` status mapping against the real gateway contract
 * (`GET /api/scans/{id}/report`: 200 bare ScanResult, 401, 404, 409
 * plain-text, 502/504). Uses a minimal real `node:http` server, same
 * approach as `errorMapping.test.ts`: the contract server cannot produce
 * upstream failures on demand.
 */
import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { configureGatewayBaseUrl, getReport } from "../../src/api";

const VALID_RESULT = {
  host: "10.9.0.1",
  ports: [
    {
      port: 22,
      protocol: "tcp",
      state: "open",
      service: "ssh",
      version: null,
      cpes: [],
    },
  ],
  vulnerabilities: [],
  scanned_at: "2026-01-01T00:00:00Z",
};

describe("getReport status mapping", () => {
  let server: Server;
  let respond: (status: number, body: string) => void;
  let next = { status: 200, body: "" };

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(next.status, { "Content-Type": "text/plain" });
      res.end(next.body);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    const port =
      typeof address === "object" && address !== null ? address.port : 0;
    configureGatewayBaseUrl(`http://127.0.0.1:${port}`);
    respond = (status, body) => {
      next = { status, body };
    };
  });

  afterEach(() => {
    next = { status: 200, body: "" };
  });

  afterAll(async () => {
    configureGatewayBaseUrl(undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("returns_the_bare_ScanResult_on_200", async () => {
    respond(200, JSON.stringify(VALID_RESULT));
    expect(await getReport("s1")).toEqual({ ok: true, value: VALID_RESULT });
  });

  it("maps_409_with_a_plain_text_body_to_not_ready", async () => {
    respond(409, "el reporte del escaneo aún no está disponible");
    expect(await getReport("s1")).toEqual({
      ok: false,
      error: { kind: "not_ready" },
    });
  });

  it("maps_404_to_not_found", async () => {
    respond(404, "scan no encontrado");
    expect(await getReport("s1")).toEqual({
      ok: false,
      error: { kind: "not_found" },
    });
  });

  it.each([502, 504])("maps_%i_to_unavailable", async (status) => {
    respond(status, "ms-usuarios no disponible");
    expect(await getReport("s1")).toEqual({
      ok: false,
      error: { kind: "unavailable" },
    });
  });

  it("maps_a_200_with_a_wrong_shape_to_unexpected", async () => {
    respond(200, JSON.stringify({ host: "x" }));
    expect(await getReport("s1")).toEqual({
      ok: false,
      error: { kind: "unexpected", status: 200 },
    });
  });
});
