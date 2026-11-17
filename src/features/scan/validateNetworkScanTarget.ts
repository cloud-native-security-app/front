/**
 * Pure client-side validator for the network (IP-only) scan target: an
 * IPv4/IPv6 literal, a hostname, or an `http(s)://` URL. It mirrors the
 * Gateway parser (host and optional port are kept; path and query are
 * ignored; userinfo and other schemes are rejected). It is a UX aid, not the
 * security control: the Gateway re-validates, resolves and applies the
 * denylist/allowlist.
 */
import {
  validateScanTarget,
  type TargetValidation,
} from "./validateScanTarget";

const HOST_MESSAGE =
  "Nombre de host inválido: usa letras, números y guiones separados por puntos (p. ej. app.example.com), sin punto final.";
const IPV6_MESSAGE =
  "Dirección IPv6 inválida. Para indicar un puerto usa una URL (p. ej. https://host:8443).";
const SCHEME_MESSAGE =
  "Esquema no soportado: usa http:// o https://, o escribe solo el host.";
const CREDENTIALS_MESSAGE =
  "La URL no puede incluir credenciales (usuario o contraseña).";
const PORT_MESSAGE = "Puerto inválido: debe ser un número entre 1 y 65535.";

const MAX_HOSTNAME_LENGTH = 253;
const LABEL_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;
const DIGITS_AND_DOTS = /^[\d.]+$/;
const HEX_GROUP = /^[0-9a-f]{1,4}$/i;
const SCHEME_PATTERN = /^([a-z][a-z0-9+.-]*):\/\//i;

function invalid(message: string): TargetValidation {
  return { valid: false, message };
}

function isIpv6Literal(host: string): boolean {
  const halves = host.split("::");
  if (halves.length > 2) {
    return false;
  }
  const groups = halves.flatMap((half) =>
    half.length === 0 ? [] : half.split(":"),
  );
  if (!groups.every((group) => HEX_GROUP.test(group))) {
    return false;
  }
  return halves.length === 2 ? groups.length < 8 : groups.length === 8;
}

function validateHostname(host: string): string | undefined {
  if (host.length === 0 || host.length > MAX_HOSTNAME_LENGTH) {
    return HOST_MESSAGE;
  }
  const labels = host.split(".");
  if (!labels.every((label) => LABEL_PATTERN.test(label))) {
    return HOST_MESSAGE;
  }
  if (/^\d+$/.test(labels[labels.length - 1])) {
    return HOST_MESSAGE;
  }
  return undefined;
}

/** Validates a bare host: IPv4, IPv6 literal or hostname. */
function validateHost(host: string): string | undefined {
  if (host.includes(":")) {
    return isIpv6Literal(host) ? undefined : IPV6_MESSAGE;
  }
  if (DIGITS_AND_DOTS.test(host)) {
    const ipv4 = validateScanTarget(host);
    return ipv4.valid ? undefined : ipv4.message;
  }
  return validateHostname(host);
}

function validatePort(port: string): boolean {
  return /^\d{1,5}$/.test(port) && Number(port) >= 1 && Number(port) <= 65535;
}

function validateUrl(input: string): TargetValidation {
  const afterScheme = input.slice(input.indexOf("://") + 3);
  const authority = afterScheme.split(/[/?#]/, 1)[0];
  if (authority.includes("@")) {
    return invalid(CREDENTIALS_MESSAGE);
  }

  let host = authority;
  let port: string | undefined;
  if (authority.startsWith("[")) {
    const close = authority.indexOf("]");
    if (close === -1) {
      return invalid(IPV6_MESSAGE);
    }
    host = authority.slice(1, close);
    const rest = authority.slice(close + 1);
    if (rest.length > 0) {
      if (!rest.startsWith(":")) {
        return invalid(HOST_MESSAGE);
      }
      port = rest.slice(1);
    }
    if (!host.includes(":") || !isIpv6Literal(host)) {
      return invalid(IPV6_MESSAGE);
    }
  } else {
    const colon = authority.indexOf(":");
    if (colon !== -1) {
      host = authority.slice(0, colon);
      port = authority.slice(colon + 1);
    }
    if (host.includes(":") || port?.includes(":")) {
      return invalid(IPV6_MESSAGE);
    }
  }

  if (port !== undefined && !validatePort(port)) {
    return invalid(PORT_MESSAGE);
  }
  const hostError = host.includes(":") ? undefined : validateHost(host);
  return hostError ? invalid(hostError) : { valid: true, target: input };
}

export function validateNetworkScanTarget(rawInput: string): TargetValidation {
  const input = rawInput.trim();
  if (input.length === 0) {
    return invalid(
      "Ingresa una IP, un nombre de host o una URL para escanear.",
    );
  }
  const scheme = SCHEME_PATTERN.exec(input);
  if (scheme) {
    const name = scheme[1].toLowerCase();
    return name === "http" || name === "https"
      ? validateUrl(input)
      : invalid(SCHEME_MESSAGE);
  }
  if (input.includes("://")) {
    return invalid(SCHEME_MESSAGE);
  }
  const error = validateHost(input);
  return error ? invalid(error) : { valid: true, target: input };
}
