/**
 * Formulario de nueva credencial de red (feature
 * `network_credentials_manager`, id 9): sin al menos una entrada configurada
 * para el objetivo, `POST /api/scans` siempre responde 422 en el Gateway
 * real (ver `docs/decisions.md`). Mismo patrón de estado que
 * `src/features/scan/ScanForm.tsx` (unión discriminada
 * idle/submitting/success/error, `describeCreateError` mapeando `ApiError`).
 *
 * `ssh_credentials_ref` es una credencial SSH real (ver
 * docs/security-scope.md): viaja en el cuerpo del `POST` pero nunca vuelve
 * en la respuesta, este componente nunca la loggea, y el input es
 * `type="password"` para que el navegador no la muestre en claro.
 *
 * `target_pattern` acepta IPv4 o IPv6 (ver
 * `gateway/src/usuarios_client.rs::NetworkCredential`), pero
 * `validateScanTarget` (feature `scan_request_form`) solo reconoce IPv4. Se
 * reutiliza igual aquí como ayuda de UX (mensaje inline no bloqueante) en
 * vez de escribir un segundo validador: bloquear el envío rechazaría un CIDR
 * IPv6 válido que el Gateway/ms-usuarios sí aceptarían, y la validación real
 * de todos modos vive aguas arriba (docs/security-scope.md, "Validación de
 * entrada").
 */

import { useState, type FormEvent } from "react";

import {
  createNetworkCredential,
  type ApiError,
  type NetworkCredential,
} from "../../api";
import {
  SESSION_EXPIRED_MESSAGE,
  networkErrorMessage,
  unexpectedErrorMessage,
} from "../../copy";
import { validateScanTarget } from "../scan/validateScanTarget";

type CreateState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

function describeCreateError(error: ApiError): string {
  switch (error.kind) {
    case "network":
      return networkErrorMessage();
    case "unauthorized":
      return SESSION_EXPIRED_MESSAGE;
    case "validation":
      return "El servidor no aceptó los datos de la credencial. Revísalos e inténtalo de nuevo.";
    case "unexpected":
      return unexpectedErrorMessage("al crear la credencial");
    default:
      return unexpectedErrorMessage("al crear la credencial");
  }
}

export interface NetworkCredentialFormProps {
  onCreated: (credential: NetworkCredential) => void;
}

export function NetworkCredentialForm({
  onCreated,
}: NetworkCredentialFormProps) {
  const [targetPattern, setTargetPattern] = useState("");
  const [networkUser, setNetworkUser] = useState("");
  const [sshCredentialsRef, setSshCredentialsRef] = useState("");
  const [hasSudo, setHasSudo] = useState(false);
  const [state, setState] = useState<CreateState>({ status: "idle" });

  const targetHint = validateScanTarget(targetPattern);
  const showTargetHint = !targetHint.valid && targetPattern.trim().length > 0;
  const targetHintId = "credential-target-pattern-hint";
  const isSubmitting = state.status === "submitting";
  const canSubmit =
    targetPattern.trim().length > 0 &&
    networkUser.trim().length > 0 &&
    sshCredentialsRef.length > 0 &&
    !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setState({ status: "submitting" });
    const result = await createNetworkCredential({
      target_pattern: targetHint.valid
        ? targetHint.target
        : targetPattern.trim(),
      network_user: networkUser.trim(),
      ssh_credentials_ref: sshCredentialsRef,
      has_sudo: hasSudo,
    });
    if (result.ok) {
      setState({ status: "success" });
      setTargetPattern("");
      setNetworkUser("");
      setSshCredentialsRef("");
      setHasSudo(false);
      onCreated(result.value);
    } else {
      setState({
        status: "error",
        message: describeCreateError(result.error),
      });
    }
  }

  return (
    <form
      aria-label="Nueva credencial de red"
      onSubmit={(event) => void handleSubmit(event)}
    >
      <label htmlFor="credential-target-pattern">IP del objetivo</label>
      <input
        id="credential-target-pattern"
        name="credential-target-pattern"
        type="text"
        value={targetPattern}
        placeholder="192.168.1.10"
        aria-describedby={showTargetHint ? targetHintId : undefined}
        disabled={isSubmitting}
        onChange={(event) => {
          setTargetPattern(event.target.value);
          setState({ status: "idle" });
        }}
      />
      {showTargetHint && (
        <p id={targetHintId}>Sugerencia: {targetHint.message}</p>
      )}

      <label htmlFor="credential-network-user">Usuario de red</label>
      <input
        id="credential-network-user"
        name="credential-network-user"
        type="text"
        value={networkUser}
        disabled={isSubmitting}
        onChange={(event) => {
          setNetworkUser(event.target.value);
          setState({ status: "idle" });
        }}
      />

      <label htmlFor="credential-ssh-ref">Credencial SSH</label>
      <input
        id="credential-ssh-ref"
        name="credential-ssh-ref"
        type="password"
        aria-describedby="credential-ssh-ref-help"
        value={sshCredentialsRef}
        disabled={isSubmitting}
        onChange={(event) => {
          setSshCredentialsRef(event.target.value);
          setState({ status: "idle" });
        }}
      />

      <p id="credential-ssh-ref-help" className="field-help">
        Contraseña SSH del usuario de red en el objetivo.
      </p>

      <label htmlFor="credential-has-sudo">
        <input
          id="credential-has-sudo"
          name="credential-has-sudo"
          type="checkbox"
          aria-describedby="credential-has-sudo-help"
          checked={hasSudo}
          disabled={isSubmitting}
          onChange={(event) => setHasSudo(event.target.checked)}
        />
        Tiene privilegios sudo
      </label>
      <p id="credential-has-sudo-help" className="field-help">
        Permite técnicas de escaneo más profundas (requiere sudo sin
        contraseña).
      </p>

      <button type="submit" disabled={!canSubmit}>
        {isSubmitting ? "Guardando…" : "Agregar credencial"}
      </button>
      {state.status === "error" && <p role="alert">{state.message}</p>}
    </form>
  );
}
