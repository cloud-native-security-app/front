/**
 * Product name and shared user-facing copy (feature `user-facing-copy`,
 * UFC-01/UFC-02). `index.html` cannot import TypeScript, so a test keeps the
 * static `<title>` in sync with the exported constant.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PRODUCT_NAME,
  PRODUCT_TITLE,
  networkErrorMessage,
  unexpectedErrorMessage,
} from "../src/copy";

describe("product name", () => {
  it("is_Security_Scan_App_and_never_the_repo_name", () => {
    expect(PRODUCT_NAME).toBe("Security Scan App");
    expect(PRODUCT_TITLE).toBe(
      "Security Scan App · Escaneo de vulnerabilidades",
    );
  });

  it("index_html_title_matches_PRODUCT_TITLE", () => {
    const html = readFileSync(resolve(__dirname, "../index.html"), "utf8");
    const match = /<title>([^<]*)<\/title>/.exec(html);
    expect(match?.[1]).toBe(PRODUCT_TITLE);
  });
});

describe("shared error copy", () => {
  it("network_message_never_mentions_the_gateway_and_keeps_the_context", () => {
    expect(networkErrorMessage()).toBe(
      "No pudimos conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.",
    );
    expect(networkErrorMessage("para borrar la credencial")).toBe(
      "No pudimos conectar con el servidor para borrar la credencial. Verifica tu conexión e inténtalo de nuevo.",
    );
  });

  it("unexpected_message_has_no_status_code", () => {
    expect(unexpectedErrorMessage("al cargar el histórico")).toBe(
      "Ocurrió un error inesperado al cargar el histórico. Inténtalo más tarde.",
    );
    expect(unexpectedErrorMessage()).not.toMatch(/código|\d{3}/);
  });
});
