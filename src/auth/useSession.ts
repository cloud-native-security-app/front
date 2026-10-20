/**
 * Hook de lectura del estado de sesión actual (ver `./SessionProvider.tsx`).
 * Debe usarse dentro de un `<SessionProvider>` — lanza un error explícito
 * si no, para detectar el error de composición pronto en vez de devolver
 * `undefined` silenciosamente.
 */

import { useContext } from "react";

import { SessionContext } from "./sessionContext";
import type { SessionState } from "./sessionTypes";

export function useSession(): SessionState {
  const session = useContext(SessionContext);
  if (session === undefined) {
    throw new Error(
      "useSession debe usarse dentro de un <SessionProvider> (ver src/auth/SessionProvider.tsx)",
    );
  }
  return session;
}
