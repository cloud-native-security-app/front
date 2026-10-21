/**
 * `ReportView` error states for the real gateway statuses (404, 502/504),
 * driven by a minimal real `node:http` server (the contract server cannot
 * produce upstream failures on demand).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { configureGatewayBaseUrl } from "../../../src/api";
import { ReportView } from "../../../src/features/report/ReportView";

describe("ReportView error states", () => {
  let server: Server;
  let status = 200;

  beforeAll(async () => {
    server = createServer((_req, res) => {
      res.writeHead(status, { "Content-Type": "text/plain" });
      res.end("detalle interno del servidor");
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    const port =
      typeof address === "object" && address !== null ? address.port : 0;
    configureGatewayBaseUrl(`http://127.0.0.1:${port}`);
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(async () => {
    configureGatewayBaseUrl(undefined);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("shows_a_friendly_not_found_message_on_404", async () => {
    status = 404;
    render(<ReportView scanId="x" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No encontramos este reporte. Puede que no exista o que no sea tuyo.",
    );
  });

  it.each([502, 504])(
    "shows_a_friendly_unavailable_message_on_%i_without_leaking_the_body",
    async (code) => {
      status = code;
      render(<ReportView scanId="x" />);
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        "El reporte no está disponible en este momento. Inténtalo de nuevo en unos minutos.",
      );
      expect(alert).not.toHaveTextContent("detalle interno");
    },
  );

  it("shows_a_loading_status_first", () => {
    status = 200;
    render(<ReportView scanId="x" />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando reporte…");
  });
});
