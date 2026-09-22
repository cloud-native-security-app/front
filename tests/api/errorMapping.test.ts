/**
 * Casos de error transversales de `src/api` que no dependen del servidor
 * de contrato completo: red caída y payload inesperado (200 con un cuerpo
 * que no matchea el shape documentado). Se usa un servidor `node:http`
 * ad-hoc mínimo, real (ver docs/verification.md: "nunca interceptando
 * fetch a nivel de módulo"), en vez del servidor de contrato completo,
 * porque estos dos casos son intencionalmente ajenos al contrato real del
 * Gateway (nadie responde JSON malformado a propósito) — están permitidos
 * explícitamente por `feature_list.json` id 2: "...contra el servidor de
 * contrato o un servidor HTTP de test en memoria".
 */

import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { configureGatewayBaseUrl, getMe } from "../../src/api";

describe("mapeo de errores de red y de payload inesperado", () => {
  afterEach(() => {
    configureGatewayBaseUrl(undefined);
  });

  it("mapea_un_fallo_de_red_a_network", async () => {
    const server = createServer((_req, res) => res.end());
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    const port =
      typeof address === "object" && address !== null ? address.port : 0;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    // El puerto ya no tiene nada escuchando: cualquier conexión debe fallar.
    configureGatewayBaseUrl(`http://127.0.0.1:${port}`);

    const result = await getMe();

    expect(result).toEqual({ ok: false, error: { kind: "network" } });
  });

  describe("con un servidor que responde 200 con un cuerpo mal formado", () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
      server = createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("esto no es JSON válido {");
      });
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      const port =
        typeof address === "object" && address !== null ? address.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("mapea_el_payload_inesperado_a_unexpected", async () => {
      configureGatewayBaseUrl(baseUrl);

      const result = await getMe();

      expect(result).toEqual({
        ok: false,
        error: { kind: "unexpected", status: 200 },
      });
    });
  });
});
