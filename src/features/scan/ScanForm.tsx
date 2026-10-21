/**
 * Formulario de nueva solicitud de escaneo (RF-02/RF-03/RF-04): valida el
 * formato de una única IP en el cliente (`validateScanTarget`, UX, no el
 * control de seguridad real — ver docs/security-scope.md) y, si es válido,
 * encola el escaneo vía `submitScan` de `src/api`, mostrando de inmediato
 * el `scanId` devuelto. Una vez encolado, `useScanEvents` (feature
 * `realtime_status`, RF-07/RF-08) refleja el estado del escaneo en tiempo
 * real sin que el usuario recargue la página.
 *
 * Presentación visual "Signals & Traces" (feature `scan_console_redesign`,
 * id 13): extiende la identidad de `HomePage` (`src/features/home/home.css`)
 * a este componente, vía `./scanForm.css` (paleta/tokens propios, scoped
 * bajo `.scan-console`, nunca editando `home.css` ni `src/index.css`). Cero
 * cambios de comportamiento respecto a la versión anterior: solo cambian
 * clases y un `<h2>` de sección nuevo.
 */

// Mismos subsets ya usados por `HomePage` (feature `home_landing_page`):
// reimportar el mismo archivo exacto de `@fontsource` no duplica peso en el
// bundle final, Vite lo dedupea a un único asset.
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import { useState, type FormEvent } from "react";

import { submitScan, type ApiError } from "../../api";
import {
  SCAN_QUEUED_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  networkErrorMessage,
  unexpectedErrorMessage,
} from "../../copy";
import "./scanForm.css";
import { ScanStatusBadge } from "./ScanStatusBadge";
import { CONNECTION_STATUS_LABEL, isTerminalScanStatus } from "./scanStatus";
import { useScanEvents } from "./useScanEvents";
import { validateScanTarget } from "./validateScanTarget";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; scanId: string }
  | { status: "error"; message: string };

function describeSubmitError(error: ApiError): string {
  switch (error.kind) {
    case "network":
      return networkErrorMessage();
    case "unauthorized":
      return SESSION_EXPIRED_MESSAGE;
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

export function ScanForm() {
  const [target, setTarget] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
  });
  const scanId =
    submitState.status === "success" ? submitState.scanId : undefined;
  const scanEvents = useScanEvents(scanId);

  const validation = validateScanTarget(target);
  const isSubmitting = submitState.status === "submitting";
  const canSubmit = validation.valid && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation.valid || isSubmitting) {
      return;
    }
    setSubmitState({ status: "submitting" });
    const result = await submitScan(validation.target);
    if (result.ok) {
      setSubmitState({ status: "success", scanId: result.value.scanId });
    } else {
      setSubmitState({
        status: "error",
        message: describeSubmitError(result.error),
      });
    }
  }

  return (
    <section className="scan-console" aria-label="Nueva solicitud de escaneo">
      <h2 className="scan-console__heading">Nueva solicitud de escaneo</h2>
      <form
        className="scan-console__form"
        onSubmit={(event) => void handleSubmit(event)}
      >
        <div className="scan-console__row">
          <div className="scan-console__field">
            <label className="scan-console__label" htmlFor="scan-target">
              IP a escanear
            </label>
            <input
              id="scan-target"
              name="scan-target"
              type="text"
              className="scan-console__input"
              value={target}
              placeholder="192.168.1.10"
              disabled={isSubmitting}
              onChange={(event) => {
                setTarget(event.target.value);
                setSubmitState({ status: "idle" });
              }}
            />
          </div>
          <button
            type="submit"
            className="scan-console__submit"
            disabled={!canSubmit}
          >
            {isSubmitting ? "Encolando…" : "Escanear"}
          </button>
        </div>
        {!validation.valid && target.trim().length > 0 && (
          <p role="alert">{validation.message}</p>
        )}
        {submitState.status === "success" && (
          <p role="status">{SCAN_QUEUED_MESSAGE}</p>
        )}
        {scanId && (
          <p role="status">
            {scanEvents.connectionStatus === "open" && (
              <span className="scan-console__live-dot" aria-hidden="true" />
            )}
            <span className="scan-console__mono">
              Estado: <ScanStatusBadge status={scanEvents.status} />
              {!isTerminalScanStatus(scanEvents.status) &&
                ` (${CONNECTION_STATUS_LABEL[scanEvents.connectionStatus]})`}
            </span>
          </p>
        )}
        {submitState.status === "error" && (
          <p role="alert">{submitState.message}</p>
        )}
      </form>
    </section>
  );
}
