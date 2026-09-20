/**
 * Estado de sesión derivado de `GET /api/me` (nunca de un token propio) y
 * el componente de ruta protegida que redirige a login si no hay sesión
 * (ver docs/architecture.md, capa 2: "src/auth", y docs/security-scope.md).
 */

export { SessionProvider } from "./SessionProvider";
export { useSession } from "./useSession";
export { ProtectedRoute } from "./ProtectedRoute";
export { LoginButton } from "./LoginButton";
export { SessionContext } from "./sessionContext";
export type { SessionState, SessionStatus } from "./sessionTypes";
