/**
 * Único módulo que conoce la URL base y el contrato HTTP/SSE del Gateway
 * (ver docs/architecture.md, capa 1: "src/api"). `front` nunca hace
 * `fetch`/`EventSource` directo fuera de este módulo.
 */

export { configureGatewayBaseUrl, gatewayBaseUrl } from "./config";
export { getMe, loginRedirectUrl, logout } from "./auth";
export { cancelScan, getScanHistory, submitScan } from "./scans";
export { getAdminMetrics, subscribeToAdminEvents } from "./admin";
export { getReport } from "./report";
export { subscribeToScanEvents } from "./scanEvents";
export { onUnauthorized } from "./unauthorized";
export {
  createNetworkCredential,
  deleteNetworkCredential,
  listNetworkCredentials,
} from "./networkCredentials";
export type { AdminEventsHandlers, AdminEventsSubscription } from "./admin";
export type { ConnectionStatus, ScanEventsSubscription } from "./scanEvents";
export type {
  AdminCriticalFinding,
  AdminDelta,
  AdminEventEntry,
  AdminInFlightScan,
  AdminKpis,
  AdminScanChange,
  AdminCountMap,
  AdminSeries,
  AdminSeriesBucket,
  AdminSnapshot,
  AdminStreamClosed,
  ApiError,
  ApiResult,
  CreateNetworkCredentialInput,
  EmailStatus,
  MeResponse,
  NetworkCredential,
  NetworkScanRejectionReason,
  Role,
  ScanHistoryEntry,
  ScanMode,
  ScanOutcomeEvent,
  ScanPort,
  ScanResult,
  ScanStatus,
  ScanVulnerability,
  SubmitScanResponse,
  VulnerabilitySeverity,
  VulnerabilitySource,
} from "./types";
