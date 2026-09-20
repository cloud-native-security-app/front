/**
 * Tipos del contrato HTTP/SSE del Gateway (wire format), tal como lo
 * documenta `progress/explore_gateway_contract.md` (fuente: repo hermano
 * `gateway`, ya implementado). Ningún tipo de aquí se inventa "razonable":
 * se copia literalmente la forma que el Gateway ya serializa.
 */

/** Estados visibles del histórico REST (`GET /api/scans`), RF-07/RF-08. */
export type ScanStatus = "PENDIENTE" | "EN_PROGRESO" | "COMPLETADO" | "FALLIDO";

/** `GET /api/me` — perfil de la sesión activa. */
export interface MeResponse {
  sub: string;
  email: string;
  name: string;
}

/**
 * Entrada del histórico (`GET /api/scans`). `scanId` es opcional en el wire
 * format real (`skip_serializing_if`) — nunca asumir que siempre viene.
 */
export interface ScanHistoryEntry {
  scanId?: string;
  target: string;
  status: ScanStatus;
  requested_at: string;
  updated_at: string;
}

/** `POST /api/scans` — respuesta de éxito (200, no 201). */
export interface SubmitScanResponse {
  scanId: string;
}

export type VulnerabilitySeverity =
  "unknown" | "info" | "low" | "medium" | "high" | "critical";

export type VulnerabilitySource = "nmap_nse" | "exploit_db" | "nvd";

export interface ScanPort {
  port: number;
  protocol: string;
  state: string;
  service: string | null;
  version: string | null;
  cpes: string[];
}

export interface ScanVulnerability {
  id: string | null;
  severity: VulnerabilitySeverity;
  description: string;
  nse_script: string;
  source: VulnerabilitySource;
  references: string[];
}

/**
 * Resultado consolidado de un escaneo. Es el mismo shape que el Gateway ya
 * serializa dentro del evento SSE `completed.result` — `getReport` (ver
 * `getReport` en `./report.ts`) reutiliza literalmente esta forma porque no
 * existe todavía un endpoint de reporte confirmado en el Gateway real (ver
 * nota en `./report.ts`).
 */
export interface ScanResult {
  host: string;
  ports: ScanPort[];
  vulnerabilities: ScanVulnerability[];
  scanned_at: string;
}

/**
 * Evento del stream SSE `GET /api/scans/{scanId}/events`, discriminado por
 * `status`. Vocabulario en inglés/snake_case, **distinto** del vocabulario
 * `PENDIENTE|EN_PROGRESO|...` del histórico REST — la traducción entre
 * ambos vocabularios es responsabilidad de una capa superior
 * (`src/features`/`src/domain`), no de `src/api`.
 */
export type ScanOutcomeEvent =
  | { status: "started"; correlation_id: string }
  | { status: "completed"; correlation_id: string; result: ScanResult }
  | { status: "failed"; correlation_id: string; reason: string };

/**
 * Errores tipados de `src/api` (ver `docs/conventions.md`). Nunca se lanza
 * un string suelto: toda función retorna un `ApiResult<T>` (ver abajo) en
 * vez de rechazar la promesa, así ningún llamante puede "olvidar" un
 * `.catch()`.
 */
export type ApiError =
  | { kind: "network" }
  | { kind: "unauthorized" }
  | { kind: "not_found" }
  /** El recurso existe pero aún no está en el estado requerido para la
   * operación pedida (p. ej. `getReport` sobre un scan no `COMPLETADO`). */
  | { kind: "not_ready" }
  | { kind: "conflict"; message: string }
  | { kind: "validation"; message: string }
  | { kind: "unexpected"; status: number };

/**
 * Resultado de toda función de `src/api` que hace una petición HTTP: nunca
 * se rechaza la promesa por un error de red/HTTP esperado (solo por un bug
 * de programación) — el llamante siempre maneja ambos casos de forma
 * explícita, sin necesidad de `try/catch`.
 */
export type ApiResult<T> =
  { ok: true; value: T } | { ok: false; error: ApiError };
