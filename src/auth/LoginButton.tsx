/**
 * Acción de login (RF-01). Nunca hace un `fetch`: el login es siempre una
 * redirección completa de navegador hacia la ruta del Gateway que inicia el
 * handshake OIDC con Google — `front` nunca ve ni maneja el token (ver
 * docs/security-scope.md).
 *
 * `label`/`className` son opcionales y solo cambian el texto/estilo visual
 * del botón (nunca la navegación): `HomePage` (feature `home_landing_page`,
 * id 12) lo reutiliza tal cual como su CTA, con el copy exacto "Iniciar
 * sesión" y una clase para integrarlo en su propio layout, en vez de
 * reimplementar un segundo botón de login.
 */

import { loginRedirectUrl } from "../api";

export function LoginButton({
  label = "Iniciar sesión con Google",
  className,
}: {
  label?: string;
  className?: string;
} = {}) {
  function handleClick(): void {
    window.location.href = loginRedirectUrl();
  }

  return (
    <button type="button" className={className} onClick={handleClick}>
      {label}
    </button>
  );
}
