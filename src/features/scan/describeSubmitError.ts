/**
 * Spanish message for every way `POST /api/scans` can be refused. Kept apart
 * from `ScanForm` so each `ApiError` kind is testable without rendering.
 */

import type { ApiError } from "../../api";
import {
  NETWORK_SCAN_NOT_PERMITTED_MESSAGE,
  NETWORK_SCAN_TARGET_REJECTED_MESSAGE,
  NETWORK_SCAN_UNAVAILABLE_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  networkErrorMessage,
  unexpectedErrorMessage,
} from "../../copy";

export function describeSubmitError(error: ApiError): string {
  switch (error.kind) {
    case "network":
      return networkErrorMessage();
    case "unauthorized":
      return SESSION_EXPIRED_MESSAGE;
    case "network_scan_not_permitted":
      return NETWORK_SCAN_NOT_PERMITTED_MESSAGE;
    case "network_scan_unavailable":
      return NETWORK_SCAN_UNAVAILABLE_MESSAGE;
    case "network_scan_target_rejected":
      return NETWORK_SCAN_TARGET_REJECTED_MESSAGE[error.reason];
    case "validation":
      return "El servidor no aceptó esa IP. Revísala e inténtalo de nuevo.";
    case "unexpected":
      // 422: no hay credencial de red configurada para el objetivo.
      if (error.status === 422) {
        return "Primero agrega una credencial de red para esa IP.";
      }
      return unexpectedErrorMessage("al encolar el escaneo");
    default:
      return unexpectedErrorMessage("al encolar el escaneo");
  }
}
