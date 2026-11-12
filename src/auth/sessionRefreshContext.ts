/**
 * Context carrying `refresh()`: re-reads `GET /api/me` so a role change made
 * after the first load (for example a revoked admin role) reaches the UI
 * without a page reload. Kept apart from `SessionContext` so consumers that
 * only read the state, and tests that inject one, do not depend on it. Outside
 * a `<SessionProvider>` it is a no-op.
 */

import { createContext, useContext } from "react";

export type RefreshSession = () => Promise<void>;

export const SessionRefreshContext = createContext<RefreshSession>(() =>
  Promise.resolve(),
);

export function useSessionRefresh(): RefreshSession {
  return useContext(SessionRefreshContext);
}
