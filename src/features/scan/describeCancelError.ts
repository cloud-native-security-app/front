/**
 * Message shown when cancelling a scan fails (RF-14). Shared by the history
 * table and the scan page so both say the same thing.
 */

import type { ApiError } from "../../api";
import {
  CANCEL_CONFLICT_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  networkErrorMessage,
  unexpectedErrorMessage,
} from "../../copy";

export function describeCancelError(error: ApiError): string {
  switch (error.kind) {
    case "network":
      return networkErrorMessage("para cancelar el escaneo");
    case "unauthorized":
      return SESSION_EXPIRED_MESSAGE;
    case "not_found":
      return "El escaneo ya no existe o no pertenece a tu sesión.";
    case "conflict":
      return CANCEL_CONFLICT_MESSAGE;
    case "unexpected":
      return unexpectedErrorMessage("al cancelar el escaneo");
    default:
      return unexpectedErrorMessage("al cancelar el escaneo");
  }
}
