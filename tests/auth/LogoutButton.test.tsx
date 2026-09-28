/**
 * Test de componente de `LogoutButton` (feature `logout_button`, id 10): no
 * se renderiza sin sesión activa (`loading`/`anonymous`); con sesión
 * activa, el clic llama a `POST /auth/logout` en el Gateway y, en éxito,
 * navega con una recarga completa de página (`window.location.href` a la
 * raíz, nunca `fetch` + estado de React puro); mientras la petición está en
 * curso el botón se deshabilita; un fallo de red muestra un error explícito
 * (`role="alert"`) sin navegar. Contra el servidor de contrato real y
 * servidores `node:http` ad-hoc para los casos de demora/red caída (mismo
 * criterio que `tests/api/errorMapping.test.ts`) — nunca `vi.mock` de
 * `src/api`.
 */
import { createServer, type Server } from "node:http";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureGatewayBaseUrl, gatewayBaseUrl } from "../../src/api";
import { LogoutButton, SessionContext } from "../../src/auth";
import type { SessionState } from "../../src/auth";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../api/testHelpers";

const LOADING_SESSION: SessionState = { status: "loading", user: undefined };
const ANONYMOUS_SESSION: SessionState = {
  status: "anonymous",
  user: undefined,
};
const AUTHENTICATED_SESSION: SessionState = {
  status: "authenticated",
  user: { sub: "1", email: "analista@example.test", name: "Analista" },
};

function renderWithSession(session: SessionState) {
  return render(
    <SessionContext.Provider value={session}>
      <LogoutButton />
    </SessionContext.Provider>,
  );
}

/** Reemplaza `window.location` por un doble que registra asignaciones a `href` en vez de navegar de verdad (jsdom no implementa navegación real, ver `tests/auth/ProtectedRoute.test.tsx`). */
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

describe("LogoutButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("no_se_renderiza_mientras_la_sesion_esta_cargando", () => {
    renderWithSession(LOADING_SESSION);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("no_se_renderiza_sin_sesion_activa", () => {
    renderWithSession(ANONYMOUS_SESSION);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  describe("con sesión activa, contra el servidor de contrato real", () => {
    useContractServer();

    beforeEach(() => {
      clearNodeTestSessionCookies();
    });

    it("el_clic_llama_a_post_auth_logout_y_navega_a_la_raiz_en_exito", async () => {
      await loginAsSyntheticUser();
      const location = stubWindowLocation();
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      renderWithSession(AUTHENTICATED_SESSION);
      await userEvent.click(
        screen.getByRole("button", { name: "Cerrar sesión" }),
      );

      await waitFor(() => {
        expect(location.assignedHrefs).toEqual(["/"]);
      });
      expect(fetchSpy).toHaveBeenCalledWith(
        `${gatewayBaseUrl()}/auth/logout`,
        expect.objectContaining({ method: "POST" }),
      );

      fetchSpy.mockRestore();
      location.restore();
    });
  });

  describe("con sesión activa, servidor con una demora artificial", () => {
    let server: Server;

    beforeEach(async () => {
      server = createServer((_req, res) => {
        setTimeout(() => {
          res.writeHead(204);
          res.end();
        }, 50);
      });
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      const port =
        typeof address === "object" && address !== null ? address.port : 0;
      configureGatewayBaseUrl(`http://127.0.0.1:${port}`);
    });

    afterEach(async () => {
      configureGatewayBaseUrl(undefined);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("deshabilita_el_boton_mientras_la_peticion_esta_en_curso", async () => {
      const location = stubWindowLocation();

      renderWithSession(AUTHENTICATED_SESSION);
      const button = screen.getByRole("button", { name: "Cerrar sesión" });
      await userEvent.click(button);

      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(/cerrando sesión/i);

      await waitFor(() => {
        expect(location.assignedHrefs).toEqual(["/"]);
      });

      location.restore();
    });
  });

  describe("con sesión activa, contra un servidor caído (fallo de red)", () => {
    let baseUrl: string;

    beforeEach(async () => {
      const server = createServer((_req, res) => res.end());
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      const port =
        typeof address === "object" && address !== null ? address.port : 0;
      await new Promise<void>((resolve) => server.close(() => resolve()));
      // El puerto ya no tiene nada escuchando: cualquier conexión debe fallar.
      baseUrl = `http://127.0.0.1:${port}`;
      configureGatewayBaseUrl(baseUrl);
    });

    afterEach(() => {
      configureGatewayBaseUrl(undefined);
    });

    it("un_fallo_de_red_muestra_un_error_explicito_sin_navegar", async () => {
      const location = stubWindowLocation();

      renderWithSession(AUTHENTICATED_SESSION);
      await userEvent.click(
        screen.getByRole("button", { name: "Cerrar sesión" }),
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          /no se pudo contactar al gateway/i,
        );
      });
      expect(location.assignedHrefs).toEqual([]);

      location.restore();
    });
  });
});
