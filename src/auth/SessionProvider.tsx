/**
 * Provee el estado de sesión de toda la app (ver docs/architecture.md,
 * capa 2: "src/auth"). Llama a `getMe()` una sola vez al montar (RF-01) y
 * se suscribe a `onUnauthorized` de `src/api` para limpiar el estado en
 * memoria ante un 401/403 ocurrido en **cualquier** llamada posterior de
 * `src/api` — no solo la de montaje (ver `feature_list.json`, feature
 * `auth_session`, criterio 4).
 *
 * Nunca lee, escribe ni loggea ningún token/cookie/credencial (ver
 * docs/security-scope.md): el único dato que maneja es el `MeResponse` ya
 * público que el propio Gateway decide devolver.
 */

import { useEffect, useState, type ReactNode } from "react";

import { getMe, onUnauthorized } from "../api";
import { SessionContext } from "./sessionContext";
import { ANONYMOUS_SESSION, LOADING_SESSION } from "./sessionTypes";
import type { SessionState } from "./sessionTypes";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(LOADING_SESSION);

  useEffect(() => {
    let active = true;

    // Se registra antes de disparar `getMe()`: si esa misma llamada
    // devuelve 401 (sin sesión), `mapCommonErrorStatus` ya dispara este
    // mismo canal (ver `src/api/httpClient.ts`) — ambos caminos convergen
    // en el mismo `ANONYMOUS_SESSION`, de forma idempotente.
    const unsubscribe = onUnauthorized(() => {
      if (active) {
        setSession(ANONYMOUS_SESSION);
      }
    });

    void getMe().then((result) => {
      if (!active) {
        return;
      }
      setSession(
        result.ok
          ? { status: "authenticated", user: result.value }
          : ANONYMOUS_SESSION,
      );
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
