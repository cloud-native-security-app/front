/**
 * Formulario de nueva solicitud de escaneo (ver docs/architecture.md, capa
 * 3: "src/features/scan").
 */

export { ScanForm } from "./ScanForm";
export { scanOutcomeEventToStatus, useScanEvents } from "./useScanEvents";
export type { ScanEventsState } from "./useScanEvents";
export { validateScanTarget } from "./validateScanTarget";
export type { TargetValidation } from "./validateScanTarget";
