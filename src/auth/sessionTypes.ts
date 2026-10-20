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
}

export const LOADING_SESSION: SessionState = {
  status: "loading",
  user: undefined,
};

export const ANONYMOUS_SESSION: SessionState = {
  status: "anonymous",
  user: undefined,
};
