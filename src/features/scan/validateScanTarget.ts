/**
 * Validador puro (sin IO) de una única IP v4 (RF-02/RF-03); `x.x.x.x/32` se acepta y se normaliza a la IP sola.
 * Es una mejora de UX, no el control de seguridad real — la autorización
 * del objetivo vive aguas arriba, en el Gateway/`ms-usuarios` (ver
 * docs/security-scope.md, "Validación de entrada").
 */

/**
 * `target` es la IP normalizada que debe enviarse (sin espacios y sin el
 * sufijo `/32`).
 */
export type TargetValidation =
  { valid: true; target: string } | { valid: false; message: string };

const RANGE_MESSAGE = "Solo se admite una única IP (no rangos).";
const FORMAT_MESSAGE =
  "Formato de IP inválido: usa una sola IP, por ejemplo 192.168.1.10.";

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
 * Reconoce una IPv4 (`192.168.1.10`) o su forma `/32` (`192.168.1.10/32`,
 * normalizada a la IP sola). Cualquier otro prefijo se rechaza con el mismo
 * sentido que el mensaje del gateway ("Solo se admite una única IP (no
 * rangos)."). Los fallos de IP siguen siendo específicos por tipo (octeto
 * fuera de rango, formato incorrecto), nunca un genérico "inválido".
 */
export function validateScanTarget(rawInput: string): TargetValidation {
  const input = rawInput.trim();
  if (input.length === 0) {
    return { valid: false, message: "Ingresa una IP para escanear." };
  }

  const segments = input.split("/");
  if (segments.length > 2) {
    return { valid: false, message: FORMAT_MESSAGE };
  }

  const [ipPart, prefixPart] = segments;
  const ipError = validateIpv4Octets(ipPart);
  if (ipError) {
    return { valid: false, message: ipError };
  }

  if (prefixPart === undefined || prefixPart === "32") {
    return { valid: true, target: ipPart };
  }

  if (!PREFIX_PATTERN.test(prefixPart) || Number(prefixPart) > 32) {
    return { valid: false, message: FORMAT_MESSAGE };
  }
  return { valid: false, message: RANGE_MESSAGE };
}
