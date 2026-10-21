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

/** Empty and success copy for the authenticated dashboard (feature `layout-and-forms`). */
export const EMPTY_CREDENTIALS_MESSAGE =
  "Todavía no tienes objetivos. Agrega el primero con el formulario de arriba.";

export const EMPTY_HISTORY_MESSAGE =
  "Todavía no hay escaneos. Lanza el primero desde «Escanear».";

export const CREDENTIAL_SAVED_MESSAGE = "Credencial guardada.";

export const SCAN_QUEUED_MESSAGE = "Escaneo en cola.";

export function confirmDeleteCredentialMessage(target: string): string {
  return `¿Borrar la credencial de ${target}?`;
}

/** Section names (feature `sectioned-navigation`): nav links and h2 headings. */
export const NAV_LABEL = "Secciones";
export const SECTION_SCAN = "Escanear";
export const SECTION_HISTORY = "Historial";
export const SECTION_TARGETS = "Objetivos";

export const LOGOUT_LABEL = "Cerrar sesión";

/** Scan form: the target is picked from the saved targets, never typed. */
export const SCAN_TARGET_LABEL = "Objetivo a escanear";
export const SCAN_TARGET_PLACEHOLDER = "Selecciona un objetivo";
export const SCAN_TARGETS_LOADING_MESSAGE = "Cargando objetivos…";
export const NO_SCAN_TARGETS_MESSAGE =
  "Agrega un objetivo para poder escanear.";

export function targetsLoadErrorMessage(
  kind: "network" | "unauthorized" | "other",
): string {
  switch (kind) {
    case "network":
      return networkErrorMessage("para cargar los objetivos");
    case "unauthorized":
      return SESSION_EXPIRED_MESSAGE;
    case "other":
      return unexpectedErrorMessage("al cargar los objetivos");
  }
}
