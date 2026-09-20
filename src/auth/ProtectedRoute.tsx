/**
 * Guard de rutas protegidas (ver docs/architecture.md, capa 2). Nunca
 * renderiza `children` mientras la sesión está `loading` o `anonymous` —
 * en el caso `anonymous`, además navega (redirección completa de
 * navegador, nunca un `fetch`) a la URL de login del Gateway.
 *
 * No depende de ninguna librería de enrutado: es un guard simple por
 * composición (envuelve el contenido a proteger), suficiente para esta
 * feature (ver `feature_list.json`, `auth_session` — no se justificó
 * añadir `react-router` u otra dependencia de routing todavía).
 */

import { useEffect, type ReactNode } from "react";

import { loginRedirectUrl } from "../api";
import { useSession } from "./useSession";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useSession();

  useEffect(() => {
    if (status === "anonymous") {
      window.location.href = loginRedirectUrl();
    }
  }, [status]);

  if (status === "loading") {
    return <p role="status">Verificando sesión…</p>;
  }

  if (status === "anonymous") {
    return <p role="status">Redirigiendo a inicio de sesión…</p>;
  }

  return <>{children}</>;
}
