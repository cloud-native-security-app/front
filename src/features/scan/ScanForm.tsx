/**
 * Sección "Escanear" (feature `sectioned-navigation`, SNV-02): el objetivo
 * ya no se teclea, se elige con un `<select>` entre los objetivos guardados
 * (`listNetworkCredentials`); sin objetivos se enlaza a "Objetivos". El
 * estado en vivo vive en `ScanActivityProvider` para sobrevivir a un cambio
 * de sección.
 *
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
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { listNetworkCredentials, submitScan, type ApiError } from "../../api";
import {
  NO_SCAN_TARGETS_MESSAGE,
  SCAN_IN_PROGRESS_LABEL,
  SCAN_QUEUED_MESSAGE,
  SCAN_TARGETS_LOADING_MESSAGE,
  SCAN_TARGET_LABEL,
  SCAN_TARGET_PLACEHOLDER,
  SECTION_SCAN,
  SECTION_TARGETS,
  SESSION_EXPIRED_MESSAGE,
  networkErrorMessage,
  targetsLoadErrorMessage,
  unexpectedErrorMessage,
} from "../../copy";
import "./scanForm.css";
import { SECTION_PATHS } from "../../routes/paths";
import { ScanStatusBadge } from "./ScanStatusBadge";
import { CONNECTION_STATUS_LABEL, isTerminalScanStatus } from "./scanStatus";
import { useScanActivity } from "./scanActivityContext";
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

type TargetsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; targets: string[] };

function describeTargetsError(error: ApiError): string {
  switch (error.kind) {
    case "network":
      return targetsLoadErrorMessage("network");
    case "unauthorized":
      return targetsLoadErrorMessage("unauthorized");
    default:
      return targetsLoadErrorMessage("other");
  }
}

export function ScanForm() {
  const [targetsState, setTargetsState] = useState<TargetsState>({
    status: "loading",
  });
  const [target, setTarget] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
  });
  const activity = useScanActivity();
  const { trackScan } = activity;

  useEffect(() => {
    let active = true;
    void listNetworkCredentials().then((result) => {
      if (!active) {
        return;
      }
      setTargetsState(
        result.ok
          ? {
              status: "loaded",
              targets: [
                ...new Set(result.value.map((entry) => entry.target_pattern)),
              ],
            }
          : { status: "error", message: describeTargetsError(result.error) },
      );
    });
    return () => {
      active = false;
    };
  }, []);

  const isScanRunning =
    activity.status === "PENDIENTE" || activity.status === "EN_PROGRESO";
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
      trackScan(result.value.scanId, validation.target);
    } else {
      setSubmitState({
        status: "error",
        message: describeSubmitError(result.error),
      });
    }
  }

  return (
    <section className="scan-console" aria-label="Nueva solicitud de escaneo">
      <h2 className="scan-console__heading" tabIndex={-1} data-section-heading>
        {SECTION_SCAN}
      </h2>
      {targetsState.status === "loading" && (
        <p role="status" data-tone="neutral">
          {SCAN_TARGETS_LOADING_MESSAGE}
        </p>
      )}
      {targetsState.status === "error" && (
        <p role="alert">{targetsState.message}</p>
      )}
      {targetsState.status === "loaded" &&
        targetsState.targets.length === 0 && (
          <p role="status" data-tone="neutral">
            {NO_SCAN_TARGETS_MESSAGE}{" "}
            <Link to={SECTION_PATHS.targets}>{SECTION_TARGETS}</Link>
          </p>
        )}
      {targetsState.status === "loaded" && targetsState.targets.length > 0 && (
        <form
          className="scan-console__form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="scan-console__row">
            <div className="scan-console__field">
              <label className="scan-console__label" htmlFor="scan-target">
                {SCAN_TARGET_LABEL}
              </label>
              <select
                id="scan-target"
                name="scan-target"
                className="scan-console__input"
                value={target}
                disabled={isSubmitting}
                onChange={(event) => {
                  setTarget(event.target.value);
                  setSubmitState({ status: "idle" });
                }}
              >
                <option value="">{SCAN_TARGET_PLACEHOLDER}</option>
                {targetsState.targets.map((saved) => (
                  <option key={saved} value={saved}>
                    {saved}
                  </option>
                ))}
              </select>
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
          {submitState.status === "error" && (
            <p role="alert">{submitState.message}</p>
          )}
        </form>
      )}
      {activity.scanId && (
        <div aria-busy={isScanRunning}>
          <p role="status">
            {activity.connectionStatus === "open" && (
              <span className="scan-console__live-dot" aria-hidden="true" />
            )}
            <span className="scan-console__mono">
              Estado: <ScanStatusBadge status={activity.status} />
              {!isTerminalScanStatus(activity.status) &&
                ` (${CONNECTION_STATUS_LABEL[activity.connectionStatus]})`}
            </span>
          </p>
          {isScanRunning && (
            <div
              className="scan-console__progress"
              role="progressbar"
              aria-label={SCAN_IN_PROGRESS_LABEL}
            />
          )}
        </div>
      )}
    </section>
  );
}
