/**
 * Harness mínimo exclusivo de e2e (ver `../auth-session.spec.ts`): monta
 * los componentes REALES de `src/auth` (nunca una reimplementación de
 * prueba ni un mock) detrás de un servidor Vite programático con proxy
 * hacia el servidor de contrato — permite ejercer en un navegador real el
 * flujo "ruta protegida" sin modificar `src/App.tsx`/`src/main.tsx` de
 * producción (ver `progress/impl_auth_session.md` para la justificación
 * completa de esta decisión).
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import {
  LoginButton,
  ProtectedRoute,
  SessionProvider,
  useSession,
} from "../../src/auth";

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
      <LoginButton />
      <ProtectedRoute>
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
