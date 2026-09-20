/**
 * Acción de login (RF-01). Nunca hace un `fetch`: el login es siempre una
 * redirección completa de navegador hacia la ruta del Gateway que inicia el
 * handshake OIDC con Google — `front` nunca ve ni maneja el token (ver
 * docs/security-scope.md).
 */

import { loginRedirectUrl } from "../api";

export function LoginButton() {
  function handleClick(): void {
    window.location.href = loginRedirectUrl();
  }

  return (
    <button type="button" onClick={handleClick}>
      Iniciar sesión con Google
    </button>
  );
}
