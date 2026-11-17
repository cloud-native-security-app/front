/**
 * Network-mode target validator (UT-04): IPv4, IPv6 literal, hostname or
 * http(s) URL, with the same rules as the Gateway parser (UX only).
 */
import { describe, expect, it } from "vitest";

import { validateNetworkScanTarget } from "../../../src/features/scan/validateNetworkScanTarget";

function message(input: string): string {
  const result = validateNetworkScanTarget(input);
  if (result.valid) {
    throw new Error(`expected "${input}" to be invalid`);
  }
  return result.message;
}

describe("validateNetworkScanTarget", () => {
  it.each([
    "192.0.2.10",
    "::1",
    "2001:db8::1",
    "app.example.com",
    "Localhost",
    "a-b.example.com",
    "http://app.example.com",
    "https://app.example.com:8443/login?x=1",
    "HTTPS://app.example.com",
    "https://192.0.2.10:8080/",
    "https://[2001:db8::1]:8443/x",
    "http://[::1]",
  ])("accepts_%s_and_sends_it_trimmed", (input) => {
    expect(validateNetworkScanTarget(`  ${input}  `)).toEqual({
      valid: true,
      target: input,
    });
  });

  it("rejects_an_empty_input", () => {
    expect(message("  ")).toMatch(/ingresa/i);
  });

  it("rejects_url_credentials", () => {
    expect(message("https://user:pass@app.example.com")).toMatch(
      /credenciales/i,
    );
    expect(message("https://user@app.example.com")).toMatch(/credenciales/i);
  });

  it("rejects_unsupported_schemes", () => {
    expect(message("ftp://app.example.com")).toMatch(/esquema no soportado/i);
    expect(message("ssh://app.example.com")).toMatch(/esquema no soportado/i);
  });

  it.each(["0", "65536", "abc", "", "-1"])("rejects_port_%s", (port) => {
    expect(message(`https://app.example.com:${port}`)).toMatch(
      /puerto inválido/i,
    );
  });

  it.each([
    "-bad.example.com",
    "bad-.example.com",
    "bad_name.example.com",
    "a..example.com",
    "exa mple.com",
    `${"a".repeat(64)}.example.com`,
    `${"a.".repeat(130)}com`,
  ])("rejects_bad_hostname_%s", (input) => {
    expect(message(input)).toMatch(/nombre de host inválido/i);
  });

  it("rejects_a_trailing_dot", () => {
    expect(message("app.example.com.")).toMatch(/nombre de host inválido/i);
  });

  it("rejects_an_all_digit_last_label", () => {
    expect(message("app.123")).toMatch(/nombre de host inválido/i);
  });

  it("keeps_the_specific_ipv4_messages", () => {
    expect(message("999.1.1.1")).toMatch(/fuera de rango/i);
    expect(message("192.168.1")).toMatch(/4 octetos/i);
  });

  it("rejects_ranges", () => {
    expect(message("10.0.0.0/24")).toMatch(/nombre de host inválido|rangos/i);
  });

  it("rejects_a_malformed_ipv6", () => {
    expect(message("1:2:3")).toMatch(/ipv6/i);
  });
});
