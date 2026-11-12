/**
 * Provee el estado de sesión de toda la app (ver docs/architecture.md,
 * capa 2: "src/auth"). Llama a `getMe()` al montar (RF-01), de nuevo solo
 * cuando alguien invoca `refresh()` (p. ej. un 403 del panel admin), y
 * se suscribe a `onUnauthorized` de `src/api` para limpiar el estado en
 * memoria ante un 401/403 ocurrido en **cualquier** llamada posterior de
 * `src/api` — no solo la de montaje (ver `docs/decisions.md`, feature
 * `auth_session`, criterio 4).
 *
 * Nunca lee, escribe ni loggea ningún token/cookie/credencial (ver
 * docs/security-scope.md): el único dato que maneja es el `MeResponse` ya
 * público que el propio Gateway decide devolver.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getMe, onUnauthorized } from "../api";
import { SessionContext } from "./sessionContext";
import { SessionRefreshContext } from "./sessionRefreshContext";
import {
  ANONYMOUS_SESSION,
  EXPIRED_SESSION,
  LOADING_SESSION,
} from "./sessionTypes";
import type { SessionState } from "./sessionTypes";

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(LOADING_SESSION);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Re-reads the profile (role included). A 401 already reaches the
  // `onUnauthorized` subscription below; any other failure (network, 5xx)
  // keeps the current user, and nothing here retries.
  const refresh = useCallback(async () => {
    const result = await getMe();
    if (result.ok && mounted.current) {
      setSession((previous) =>
        previous.status === "authenticated"
          ? { status: "authenticated", user: result.value }
          : previous,
      );
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Se registra antes de disparar `getMe()`: si esa misma llamada
    // devuelve 401 (sin sesión), `mapCommonErrorStatus` ya dispara este
    // mismo canal (ver `src/api/httpClient.ts`) — ambos caminos convergen
    // en el mismo `ANONYMOUS_SESSION`, de forma idempotente.
    const unsubscribe = onUnauthorized(() => {
      if (active) {
        // Only a session that was actually authenticated "expired"; a 401
        // while loading/anonymous (first visit) must not show the notice.
        setSession((previous) =>
          previous.status === "authenticated"
            ? EXPIRED_SESSION
            : previous.status === "loading"
              ? ANONYMOUS_SESSION
              : previous,
        );
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
      <SessionRefreshContext.Provider value={refresh}>
        {children}
      </SessionRefreshContext.Provider>
    </SessionContext.Provider>
  );
}
