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
export const SECTION_ADMIN = "Administración";

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

/** Admin panel (feature `admin-panel`). */
export const ADMIN_LOADING_MESSAGE = "Cargando el panel de administración…";
export const ADMIN_FORBIDDEN_MESSAGE =
  "Tu cuenta ya no tiene permisos de administración. Puedes seguir usando el resto de la aplicación.";
export const ADMIN_UNVERIFIABLE_MESSAGE =
  "No pudimos verificar tu rol de administrador. Reintentando automáticamente…";
export const BACK_TO_SCAN_LABEL = "Volver a Escanear";

export const ADMIN_CONNECTION_LABEL = "Estado de la conexión";
export function adminConnectionMessage(
  status: "connecting" | "live" | "reconnecting" | "unavailable",
): string {
  switch (status) {
    case "live":
      return "En vivo";
    case "connecting":
      return "Conectando…";
    case "reconnecting":
      return "Reconectando… los datos mostrados pueden estar desactualizados.";
    case "unavailable":
      return `${ADMIN_UNVERIFIABLE_MESSAGE} Los datos mostrados pueden estar desactualizados.`;
  }
}

export const ADMIN_KPI_SECTION_LABEL = "Indicadores";
export const kpiLabels = (windowMinutes: number) =>
  ({
    scansInFlight: "Escaneos en curso",
    completed: `Completados (últimos ${String(windowMinutes)} min)`,
    failed: `Fallidos (últimos ${String(windowMinutes)} min)`,
    failureRate: "Tasa de fallos",
    activeUsers: "Usuarios activos",
    rateLimitHits: `Límites de tasa alcanzados (últimos ${String(windowMinutes)} min)`,
    malformed: "Registros malformados",
  }) as const;

export const ADMIN_SCANS_TITLE = "Escaneos en curso";
export const ADMIN_NO_SCANS_MESSAGE = "No hay escaneos en curso.";
export const ADMIN_SCAN_COLUMNS = {
  scan: "Escaneo",
  status: "Estado",
  since: "Desde",
} as const;
export const ADMIN_SCAN_STATUS_LABEL = {
  requested: "Solicitado",
  running: "En ejecución",
} as const;

export const ADMIN_FINDINGS_TITLE = "Hallazgos críticos";
export const ADMIN_NO_FINDINGS_MESSAGE = "Sin hallazgos críticos recientes.";
export const ADMIN_FINDINGS_LIVE_LABEL = "Avisos de hallazgos críticos";
/** Where a finding is: a port or the whole host (no port in the event). */
export function findingLocation(
  port: number | null,
  protocol: string | null,
): string {
  if (port === null) {
    return "Host";
  }
  return protocol
    ? `Puerto ${String(port)}/${protocol}`
    : `Puerto ${String(port)}`;
}
export function newCriticalFindingAnnouncement(finding: {
  cve_id: string | null;
  port: number | null;
  protocol: string | null;
  scan_id: string;
}): string {
  const what = finding.cve_id ?? "sin CVE";
  const where =
    finding.port === null
      ? "en el host"
      : `en el puerto ${String(finding.port)}${finding.protocol ? `/${finding.protocol}` : ""}`;
  return `Nuevo hallazgo crítico: ${what} ${where} (escaneo ${finding.scan_id}).`;
}

export const ADMIN_EVENTS_TITLE = "Registro de eventos";
export const ADMIN_EVENT_FILTER_LABEL = "Tipo de evento";
export const ADMIN_ALL_EVENT_TYPES_LABEL = "Todos los tipos";
export const ADMIN_NO_EVENTS_MESSAGE = "Todavía no hay eventos.";
export const ADMIN_NO_EVENTS_FOR_FILTER_MESSAGE =
  "Ningún evento coincide con el tipo seleccionado.";
export const ADMIN_EVENT_COLUMNS = {
  time: "Hora",
  type: "Tipo",
  source: "Origen",
  scan: "Escaneo",
  detail: "Detalle",
} as const;
export const ADMIN_EVENT_DETAIL_LABEL = "Ver carga";
export const ADMIN_EVENTS_PAUSE_LABEL = "Pausar registro";
export const ADMIN_EVENTS_RESUME_LABEL = "Reanudar registro";
/** Events received while the log is paused (frozen on screen). */
export function adminPendingEvents(count: number): string {
  return count === 1 ? "1 evento nuevo" : `${String(count)} eventos nuevos`;
}
/**
 * Accessible names of the fixed-height scroll regions (keyboard scrollable).
 * They differ from the section titles so each region name stays unique.
 */
export const ADMIN_SCANS_REGION_LABEL = "Lista desplazable de escaneos";
export const ADMIN_FINDINGS_REGION_LABEL = "Lista desplazable de hallazgos";
export const ADMIN_EVENTS_REGION_LABEL = "Lista desplazable de eventos";
/** Scans in flight not rendered because only the newest are shown. */
export function adminHiddenScans(count: number): string {
  return `y ${String(count)} más`;
}
export function adminEventCount(shown: number, total: number): string {
  return `Mostrando ${String(shown)} de ${String(total)}`;
}
