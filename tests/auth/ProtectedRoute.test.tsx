/**
 * Tests de componente de `ProtectedRoute` (feature `auth_session`,
 * criterio 2): nunca renderiza el contenido protegido mientras la sesión
 * está `loading` o `anonymous`, y en `anonymous` navega (asignación de
 * `window.location.href`, nunca `fetch`) a la URL de login del Gateway.
 *
 * Inyecta un `SessionState` arbitrario vía `SessionContext` en vez de
 * pasar por el servidor de contrato: el comportamiento de `getMe()` ya se
 * cubre en `SessionProvider.test.tsx`, aquí solo importa la reacción del
 * guard a cada estado posible.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { configureGatewayBaseUrl, gatewayBaseUrl } from "../../src/api";
import { ProtectedRoute, SessionContext } from "../../src/auth";
import type { SessionState } from "../../src/auth";

function renderProtected(session: SessionState) {
  return render(
    <SessionContext.Provider value={session}>
      <ProtectedRoute>
        <p>Contenido secreto</p>
      </ProtectedRoute>
    </SessionContext.Provider>,
  );
}

/** Reemplaza `window.location` por un doble que registra asignaciones a `href` en vez de navegar de verdad (jsdom no implementa navegación real). */
function stubWindowLocation(): {
  assignedHrefs: string[];
  restore: () => void;
} {
  const original = window.location;
  const assignedHrefs: string[] = [];
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...original,
      set href(value: string) {
        assignedHrefs.push(value);
      },
      get href() {
        return original.href;
      },
    },
  });
  return {
    assignedHrefs,
    restore: () => {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      });
    },
  };
}

describe("ProtectedRoute", () => {
  beforeAll(() => {
    configureGatewayBaseUrl("http://gateway.contract-test.local");
  });

  afterEach(() => {
    configureGatewayBaseUrl("http://gateway.contract-test.local");
    cleanup();
  });

  it("no_renderiza_contenido_protegido_mientras_la_sesion_esta_cargando", () => {
    renderProtected({ status: "loading", user: undefined });

    expect(screen.queryByText("Contenido secreto")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("no_renderiza_contenido_protegido_y_navega_a_login_si_la_sesion_es_anonima", () => {
    const location = stubWindowLocation();

    renderProtected({ status: "anonymous", user: undefined });

    expect(screen.queryByText("Contenido secreto")).not.toBeInTheDocument();
    expect(location.assignedHrefs).toEqual([`${gatewayBaseUrl()}/auth/login`]);

    location.restore();
  });

  it("renderiza_el_contenido_protegido_si_la_sesion_esta_autenticada", () => {
    renderProtected({
      status: "authenticated",
      user: { sub: "1", email: "analista@example.test", name: "Analista" },
    });

    expect(screen.getByText("Contenido secreto")).toBeInTheDocument();
  });
});
