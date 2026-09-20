/**
 * Punto de montaje de la aplicación (ver docs/architecture.md, capa 8).
 * `SessionProvider` envuelve toda la app; el `<h1>front</h1>` es una
 * cabecera persistente del shell, montada FUERA de `ProtectedRoute` a
 * propósito: es el smoke test de la feature `scaffolding`
 * (`e2e/scaffolding.spec.ts`) y debe seguir visible sin depender del
 * estado de sesión. El contenido de negocio (`ScanForm`, RF-02/RF-03/RF-04)
 * sí exige sesión activa, por eso vive dentro de `ProtectedRoute` (ver
 * `feature_list.json`, feature `scan_request_form`, id 4 — primera feature
 * que integra `SessionProvider`/`ProtectedRoute` en la app real).
 */

import { ProtectedRoute, SessionProvider } from "./auth";
import { ScanForm } from "./features/scan";

export function App() {
  return (
    <SessionProvider>
      <main>
        <h1>front</h1>
        <ProtectedRoute>
          <ScanForm />
        </ProtectedRoute>
      </main>
    </SessionProvider>
  );
}
