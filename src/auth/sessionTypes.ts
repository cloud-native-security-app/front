/**
 * Forma del estado de sesión que expone `src/auth` (ver
 * docs/architecture.md, capa 2). Se deriva siempre de `GET /api/me` (nunca
 * de inspeccionar una cookie — ver docs/security-scope.md), y nunca
 * contiene un token ni una credencial: solo el perfil ya público que el
 * propio Gateway devuelve (`sub`/`email`/`name`).
 */

import type { MeResponse } from "../api";

export type SessionStatus = "loading" | "authenticated" | "anonymous";

export interface SessionState {
  status: SessionStatus;
  user: MeResponse | undefined;
  /**
   * `true` only when an authenticated session was ended by a 401/403
   * (never for a first visit). Drives the "session expired" notice.
   */
  expired?: boolean;
}

export const LOADING_SESSION: SessionState = {
  status: "loading",
  user: undefined,
};

export const ANONYMOUS_SESSION: SessionState = {
  status: "anonymous",
  user: undefined,
};

export const EXPIRED_SESSION: SessionState = {
  status: "anonymous",
  user: undefined,
  expired: true,
};
