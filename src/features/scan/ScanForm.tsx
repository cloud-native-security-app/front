/**
 * Formulario de nueva solicitud de escaneo (RF-02/RF-03/RF-04): valida el
 * formato de IP/rango en el cliente (`validateScanTarget`, UX, no el
 * control de seguridad real — ver docs/security-scope.md) y, si es válido,
 * encola el escaneo vía `submitScan` de `src/api`, mostrando de inmediato
 * el `scanId` devuelto. Una vez encolado, `useScanEvents` (feature
 * `realtime_status`, RF-07/RF-08) refleja el estado del escaneo en tiempo
 * real sin que el usuario recargue la página.
 */

import { useState, type FormEvent } from "react";

import { submitScan, type ApiError, type ConnectionStatus } from "../../api";
import { useScanEvents } from "./useScanEvents";
import { validateScanTarget } from "./validateScanTarget";

const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: "conectando",
  open: "en vivo",
  reconnecting: "reconectando",
  closed: "desconectado",
};

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; scanId: string }
  | { status: "error"; message: string };

function describeSubmitError(error: ApiError): string {
  switch (error.kind) {
    case "network":
      return "No se pudo contactar al Gateway. Verifica tu conexión e inténtalo de nuevo.";
    case "unauthorized":
      return "Tu sesión ya no es válida. Inicia sesión nuevamente.";
    case "validation":
      return `El Gateway rechazó el objetivo: ${error.message}`;
    case "unexpected":
      return `Ocurrió un error inesperado (código ${error.status}). Inténtalo más tarde.`;
    default:
      return "Ocurrió un error inesperado al encolar el escaneo.";
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
    const result = await submitScan(target.trim());
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
    <form onSubmit={(event) => void handleSubmit(event)}>
      <label htmlFor="scan-target">IP o rango a escanear</label>
      <input
        id="scan-target"
        name="scan-target"
        type="text"
        value={target}
        placeholder="192.168.1.0/24"
        disabled={isSubmitting}
        onChange={(event) => {
          setTarget(event.target.value);
          setSubmitState({ status: "idle" });
        }}
      />
      {!validation.valid && target.trim().length > 0 && (
        <p role="alert">{validation.message}</p>
      )}
      <button type="submit" disabled={!canSubmit}>
        {isSubmitting ? "Encolando…" : "Escanear"}
      </button>
      {submitState.status === "success" && (
        <p role="status">Escaneo encolado. ID: {submitState.scanId}</p>
      )}
      {scanId && (
        <p role="status">
          Estado: {scanEvents.status} (
          {CONNECTION_STATUS_LABEL[scanEvents.connectionStatus]})
        </p>
      )}
      {submitState.status === "error" && (
        <p role="alert">{submitState.message}</p>
      )}
    </form>
  );
}
