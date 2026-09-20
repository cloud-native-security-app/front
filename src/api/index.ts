/**
 * Único módulo que conocerá la URL base y el contrato HTTP/SSE del Gateway
 * (ver docs/architecture.md, capa 1: "src/api"). `front` nunca hace
 * `fetch`/`EventSource` directo fuera de este módulo.
 *
 * Placeholder de la feature `scaffolding` (feature_list.json, id 1): las
 * funciones tipadas del contrato (`getMe`, `submitScan`, `getScanHistory`,
 * `cancelScan`, `subscribeToScanEvents`, `getReport`, `loginRedirectUrl`) y
 * el tipo `ApiError` se implementan en la feature `api_client` (id 2).
 */

export {};
