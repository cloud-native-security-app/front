/**
 * Acción de cerrar sesión (feature `logout_button`, id 10): llama a
 * `logout()` (`POST /auth/logout` vía `src/api`) y, en éxito, navega con una
 * recarga completa de página (`window.location.href` a la raíz de `front`,
 * nunca un `fetch` + estado de React puro) para que `SessionProvider`
 * rehidrate el estado de sesión desde cero contra el Gateway — mismo
 * principio ya establecido en `LoginButton`/`ProtectedRoute` (ver
 * docs/architecture.md, capa 2). Tras la recarga, `getMe()` responde 401
 * (cookie ya invalidada por el Gateway) y `ProtectedRoute` redirige a login
 * por su cuenta, sin lógica adicional aquí.
 *
 * Solo se renderiza con sesión activa (`useSession().status ===
 * "authenticated"`) — nunca en `loading`/`anonymous`.
 */

import { useState } from "react";

import { logout, type ApiError } from "../api";
import { networkErrorMessage, unexpectedErrorMessage } from "../copy";
import { useSession } from "./useSession";

type LogoutState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

function describeLogoutError(error: ApiError): string {
  if (error.kind === "network") {
    return networkErrorMessage("para cerrar sesión");
  }
  return unexpectedErrorMessage("al cerrar sesión");
}

export function LogoutButton() {
  const { status } = useSession();
  const [state, setState] = useState<LogoutState>({ status: "idle" });

  if (status !== "authenticated") {
    return null;
  }

  async function handleClick(): Promise<void> {
    setState({ status: "submitting" });
    const result = await logout();
    if (result.ok) {
      window.location.href = "/";
      return;
    }
    setState({ status: "error", message: describeLogoutError(result.error) });
  }

  return (
    <div>
      <button
        type="button"
        className="button--secondary"
        disabled={state.status === "submitting"}
        onClick={() => void handleClick()}
      >
        {state.status === "submitting" ? "Cerrando sesión…" : "Cerrar sesión"}
      </button>
      {state.status === "error" && <p role="alert">{state.message}</p>}
    </div>
  );
}
