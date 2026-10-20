/**
 * Tests de componente de `ProtectedRoute` (feature `auth_session`,
 * criterio 2): nunca renderiza el contenido protegido mientras la sesión
 * está `loading` o `anonymous`.
 *
 * Ajuste (feature `home_landing_page`, id 12): el caso `anonymous` ya no
 * navega automáticamente al Gateway (`window.location.href`) — en vez de
 * eso, `ProtectedRoute` renderiza el nodo `anonymousView` que le pasa quien
 * lo usa (ver `src/App.tsx`, que le pasa `HomePage`). Aquí se usa un stub
 * simple (`<p>vista anónima de prueba</p>`) en vez del `HomePage` real,
 * para mantener este test desacoplado de una feature distinta (ver
 * `tests/features/home/HomePage.test.tsx` para los tests propios de
 * `HomePage`).
 *
 * Inyecta un `SessionState` arbitrario vía `SessionContext` en vez de
 * pasar por el servidor de contrato: el comportamiento de `getMe()` ya se
 * cubre en `SessionProvider.test.tsx`, aquí solo importa la reacción del
 * guard a cada estado posible.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ProtectedRoute, SessionContext } from "../../src/auth";
import type { SessionState } from "../../src/auth";

const ANONYMOUS_VIEW_STUB = <p>vista anónima de prueba</p>;

function renderProtected(session: SessionState) {
  return render(
    <SessionContext.Provider value={session}>
      <ProtectedRoute anonymousView={ANONYMOUS_VIEW_STUB}>
        <p>Contenido secreto</p>
      </ProtectedRoute>
    </SessionContext.Provider>,
  );
}

describe("ProtectedRoute", () => {
  afterEach(() => {
    cleanup();
  });

  it("no_renderiza_contenido_protegido_mientras_la_sesion_esta_cargando", () => {
    renderProtected({ status: "loading", user: undefined });

    expect(screen.queryByText("Contenido secreto")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("no_renderiza_contenido_protegido_y_renderiza_anonymousView_si_la_sesion_es_anonima", () => {
    renderProtected({ status: "anonymous", user: undefined });

    expect(screen.queryByText("Contenido secreto")).not.toBeInTheDocument();
    expect(screen.getByText("vista anónima de prueba")).toBeInTheDocument();
  });

  it("renderiza_el_contenido_protegido_si_la_sesion_esta_autenticada", () => {
    renderProtected({
      status: "authenticated",
      user: { sub: "1", email: "analista@example.test", name: "Analista" },
    });

    expect(screen.getByText("Contenido secreto")).toBeInTheDocument();
  });
});
