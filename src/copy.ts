/**
 * User-facing copy shared across features (feature `user-facing-copy`).
 * One source for the product name and for the error wording that does not
 * depend on a specific screen. `index.html` cannot import this module, so
 * `tests/copy.test.ts` asserts its static `<title>` equals `PRODUCT_TITLE`.
 */

export const PRODUCT_NAME = "Security Scan App";

export const PRODUCT_TITLE = `${PRODUCT_NAME} · Escaneo de vulnerabilidades`;

export const SESSION_EXPIRED_MESSAGE =
  "Tu sesión ya no es válida. Inicia sesión nuevamente.";

/** `purpose` completes the sentence, e.g. "para borrar la credencial". */
export function networkErrorMessage(purpose?: string): string {
  const context = purpose ? ` ${purpose}` : "";
  return `No pudimos conectar con el servidor${context}. Verifica tu conexión e inténtalo de nuevo.`;
}

/** `purpose` completes the sentence, e.g. "al cargar el histórico". */
export function unexpectedErrorMessage(purpose?: string): string {
  const context = purpose ? ` ${purpose}` : "";
  return `Ocurrió un error inesperado${context}. Inténtalo más tarde.`;
}
