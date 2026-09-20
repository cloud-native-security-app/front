/**
 * Único módulo que conoce la URL base y el contrato HTTP/SSE del Gateway
 * (ver docs/architecture.md, capa 1: "src/api"). `front` nunca hace
 * `fetch`/`EventSource` directo fuera de este módulo.
 */

export { configureGatewayBaseUrl, gatewayBaseUrl } from "./config";
export { getMe, loginRedirectUrl } from "./auth";
export { cancelScan, getScanHistory, submitScan } from "./scans";
export { getReport } from "./report";
export { subscribeToScanEvents } from "./scanEvents";
export { onUnauthorized } from "./unauthorized";
export type { ConnectionStatus, ScanEventsSubscription } from "./scanEvents";
export type {
  ApiError,
  ApiResult,
  MeResponse,
  ScanHistoryEntry,
  ScanOutcomeEvent,
  ScanPort,
  ScanResult,
  ScanStatus,
  ScanVulnerability,
  SubmitScanResponse,
  VulnerabilitySeverity,
  VulnerabilitySource,
} from "./types";
