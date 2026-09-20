/**
 * Validador puro (sin IO) de formato de IP v4/rango CIDR (RF-02/RF-03).
 * Es una mejora de UX, no el control de seguridad real — la autorización
 * del objetivo vive aguas arriba, en el Gateway/`ms-usuarios` (ver
 * docs/security-scope.md, "Validación de entrada").
 */

export type TargetValidation =
  { valid: true } | { valid: false; message: string };

const OCTET_PATTERN = /^\d{1,3}$/;
const PREFIX_PATTERN = /^\d{1,2}$/;

function validateIpv4Octets(ip: string): string | undefined {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return (
      `Formato de IP inválido: se esperan 4 octetos separados por puntos ` +
      `(p. ej. 192.168.1.1), recibido "${ip}".`
    );
  }
  for (const part of parts) {
    if (!OCTET_PATTERN.test(part)) {
      return `Octeto inválido "${part}": debe ser un número entre 0 y 255.`;
    }
    const value = Number(part);
    if (value > 255) {
      return `Octeto fuera de rango "${part}": debe estar entre 0 y 255.`;
    }
  }
  return undefined;
}

/**
 * Reconoce una IPv4 (`192.168.1.10`) o un rango CIDR (`192.168.1.0/24`)
 * válidos. Rechaza cualquier otra entrada con un mensaje específico del
 * tipo de fallo (octeto fuera de rango, formato incorrecto, prefijo CIDR
 * inválido) — nunca un genérico "inválido".
 */
export function validateScanTarget(rawInput: string): TargetValidation {
  const input = rawInput.trim();
  if (input.length === 0) {
    return {
      valid: false,
      message: "Ingresa una IP o un rango CIDR para escanear.",
    };
  }

  const segments = input.split("/");
  if (segments.length > 2) {
    return {
      valid: false,
      message:
        `Formato CIDR inválido: se esperaba "<IP>/<prefijo>" ` +
        `(recibido "${input}").`,
    };
  }

  const [ipPart, prefixPart] = segments;
  const ipError = validateIpv4Octets(ipPart);
  if (ipError) {
    return { valid: false, message: ipError };
  }

  if (prefixPart === undefined) {
    return { valid: true };
  }

  if (!PREFIX_PATTERN.test(prefixPart)) {
    return {
      valid: false,
      message: `Prefijo CIDR inválido "${prefixPart}": debe ser un número entre 0 y 32.`,
    };
  }
  const prefixValue = Number(prefixPart);
  if (prefixValue > 32) {
    return {
      valid: false,
      message: `Prefijo CIDR fuera de rango "${prefixPart}": debe estar entre 0 y 32.`,
    };
  }

  return { valid: true };
}
