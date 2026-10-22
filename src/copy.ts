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

/** History: reason line under failed and cancelled scans. */
export function failureReasonLine(reason: string): string {
  return `Motivo: ${reason}`;
}

export const CANCEL_CONFLICT_MESSAGE =
  "El escaneo ya no se puede cancelar: probablemente ya terminó o fue cancelado.";

/** Report view (feature `scan-report`). */
export const REPORT_LOADING_MESSAGE = "Cargando reporte…";
export const REPORT_NOT_FOUND_MESSAGE =
  "No encontramos este reporte. Puede que no exista o que no sea tuyo.";
export const REPORT_UNAVAILABLE_MESSAGE =
  "El reporte no está disponible en este momento. Inténtalo de nuevo en unos minutos.";
export const BACK_TO_HISTORY_LABEL = "Volver al historial";
export const EXPORT_REPORT_LABEL = "Exportar reporte (JSON)";

/** Finding confidence badges and the one-per-report explanation (report readability). */
export const CONFIDENCE_CONFIRMED_LABEL = "Confirmada";

export const CONFIDENCE_VERSION_MATCH_LABEL = "Posible (según versión)";

export const CONFIDENCE_VERSION_MATCH_NOTE =
  "Detectada comparando la versión del servicio. Las distribuciones como Amazon Linux o RHEL suelen aplicar parches sin cambiar la versión, así que podría estar ya corregida.";

/** Report readability: severity summary/filter, confidence groups, CVE links. */
export const SEVERITY_LABEL = {
  unknown: "Desconocida",
  info: "Informativa",
  low: "Baja",
  medium: "Media",
  high: "Alta",
  critical: "Crítica",
} as const;

export const SEVERITY_SUMMARY_LABEL = "Resumen por severidad";

export const SEVERITY_FILTER_HINT =
  "Pulsa una severidad para mostrar u ocultar sus hallazgos.";

export const CONFIRMED_GROUP_TITLE = "Confirmadas";

export const VERSION_MATCH_GROUP_TITLE = "Posibles (según versión)";

export const FINDING_DETAILS_LABEL = "Detalles";

export const collapsedDuplicatesNote = (count: number): string =>
  count === 1
    ? "1 coincidencia repetida se agrupó con otra del mismo identificador (se conserva la de mayor severidad)."
    : `${count} coincidencias repetidas se agruparon con otras del mismo identificador (se conserva la de mayor severidad).`;

export const UNPATCHED_QUALIFIER = "· sin parche";

export const dismissedByBackportNote = (count: number): string =>
  count === 1
    ? "1 descartada por backport (verificada como corregida en el equipo)."
    : `${count} descartadas por backport (verificadas como corregidas en el equipo).`;

export const NO_FINDINGS_FOR_FILTER_MESSAGE =
  "Ningún hallazgo coincide con las severidades seleccionadas.";

export const cveLinkLabel = (id: string): string => `Ver ${id} en NVD`;

/** Theme toggle (feature `theme-and-contrast`). */
export const THEME_LABEL = "Tema";

export function themeChoiceLabel(choice: "system" | "light" | "dark"): string {
  switch (choice) {
    case "light":
      return "Claro";
    case "dark":
      return "Oscuro";
    default:
      return "Sistema";
  }
}

/** Accessible name of the icon-only theme toggle: current mode + the action. */
export function themeToggleLabel(choice: "system" | "light" | "dark"): string {
  return `${THEME_LABEL}: ${themeChoiceLabel(choice).toLowerCase()}. Cambiar.`;
}

/** Keyboard and live feedback (feature `keyboard-and-live-feedback`). */
export const SKIP_TO_CONTENT_LABEL = "Saltar al contenido";
export const SCAN_IN_PROGRESS_LABEL = "Escaneo en curso";
export const SCAN_NOTICE_DISMISS_LABEL = "Cerrar aviso";
export const SCAN_NOTICE_VIEW_REPORT_LABEL = "Ver reporte";

const SCAN_OUTCOME_WORD = {
  COMPLETADO: "completado",
  FALLIDO: "falló",
  CANCELADO: "cancelado",
} as const;

/** "Escaneo de 10.0.0.5 completado"; the target is omitted when unknown. */
export function scanFinishedMessage(
  status: keyof typeof SCAN_OUTCOME_WORD,
  target: string | undefined,
): string {
  const subject = target ? `Escaneo de ${target}` : "Escaneo";
  return `${subject} ${SCAN_OUTCOME_WORD[status]}`;
}
