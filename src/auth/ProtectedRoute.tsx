/**
 * Guard de rutas protegidas (ver docs/architecture.md, capa 2). Nunca
 * renderiza `children` mientras la sesión está `loading` o `anonymous`.
 *
 * En el caso `anonymous`, renderiza `anonymousView` (p. ej. `HomePage`,
 * feature `home_landing_page`, id 12) en vez de redirigir automáticamente
 * al Gateway: el visitante ve contenido real con un CTA explícito de login,
 * en vez de un rebote silencioso. `ProtectedRoute` recibe ese nodo ya
 * armado por quien lo usa (p. ej. `src/App.tsx`) — `src/auth` nunca importa
 * de `src/features/*` (violaría las capas de docs/architecture.md).
 *
 * No depende de ninguna librería de enrutado: es un guard simple por
 * composición (envuelve el contenido a proteger), suficiente para esta
 * feature (ver `feature_list.json`, `auth_session` — no se justificó
 * añadir `react-router` u otra dependencia de routing todavía).
 */

import type { ReactNode } from "react";

import { useSession } from "./useSession";

export function ProtectedRoute({
  children,
  anonymousView,
}: {
  children: ReactNode;
  anonymousView: ReactNode;
}) {
  const { status } = useSession();

  if (status === "loading") {
    return <p role="status">Verificando sesión…</p>;
  }

  if (status === "anonymous") {
    return <>{anonymousView}</>;
  }

  return <>{children}</>;
}
