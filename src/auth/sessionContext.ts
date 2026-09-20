/**
 * Contexto de React que transporta el `SessionState` actual (ver
 * `./sessionTypes.ts`). Se expone crudo (además del hook `useSession`,
 * preferido por los consumidores normales) únicamente para poder inyectar
 * un `SessionState` arbitrario en tests de componente (p. ej.
 * `tests/auth/ProtectedRoute.test.tsx`) sin depender del servidor de
 * contrato para casos que ya están cubiertos por los tests del propio
 * `SessionProvider`.
 */

import { createContext } from "react";

import type { SessionState } from "./sessionTypes";

export const SessionContext = createContext<SessionState | undefined>(
  undefined,
);
