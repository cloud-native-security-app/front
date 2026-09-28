/**
 * Harness mínimo exclusivo de e2e (ver `../auth-session.spec.ts`): monta
 * los componentes REALES de `src/auth` (nunca una reimplementación de
 * prueba ni un mock) detrás de un servidor Vite programático con proxy
 * hacia el servidor de contrato — permite ejercer en un navegador real el
 * flujo "ruta protegida" sin modificar `src/App.tsx`/`src/main.tsx` de
 * producción (ver `progress/impl_auth_session.md` para la justificación
 * completa de esta decisión).
 *
 * Ajuste (feature `home_landing_page`, id 12): `ProtectedRoute` ahora exige
 * una prop `anonymousView` — se le pasa el `HomePage` real (no un stub, a
 * diferencia de `tests/auth/ProtectedRoute.test.tsx`) para poder ejercer en
 * un navegador real el flujo completo "visitante anónimo ve la página de
 * inicio y hace clic en su CTA para ir a login", igual que ocurre en
 * `src/App.tsx`. El `<LoginButton />` que antes se montaba suelto, fuera de
 * `ProtectedRoute`, se quita: ya no hace falta, el CTA de `HomePage` cubre
 * ese caso y ningún test de este archivo ejercía ese botón suelto.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ProtectedRoute, SessionProvider, useSession } from "../../src/auth";
import { HomePage } from "../../src/features/home";

/**
 * Entry point de un harness de test (sin HMR real: cada test arranca su
 * propio servidor Vite y navega una sola vez), no un módulo de producción
 * — separar estos dos componentes en archivos propios solo para satisfacer
 * Fast Refresh no aporta nada aquí.
 */
// eslint-disable-next-line react-refresh/only-export-components
function ProtectedContent() {
  const { user } = useSession();
  return (
    <div>
      <h1>Contenido protegido</h1>
      <p>Sesión de: {user?.email}</p>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- ver el comentario de `ProtectedContent` arriba.
function Harness() {
  return (
    <SessionProvider>
      <ProtectedRoute anonymousView={<HomePage />}>
        <ProtectedContent />
      </ProtectedRoute>
    </SessionProvider>
  );
}

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("No se encontró el elemento #root en index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
