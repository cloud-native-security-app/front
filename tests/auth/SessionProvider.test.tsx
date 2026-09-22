/**
 * Tests del hook/contexto de sesión (`src/auth`, feature `auth_session`):
 * `loading -> authenticated` / `loading -> anonymous` según la respuesta de
 * `getMe()`, y la limpieza en memoria ante un 401/403 de cualquier otra
 * llamada de `src/api` (criterio 4). Usa el servidor de contrato real
 * in-process (igual que `tests/api/`), nunca mocks de `src/api`.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getScanHistory } from "../../src/api";
import { SessionProvider, useSession } from "../../src/auth";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../api/testHelpers";

function SessionProbe() {
  const { status, user } = useSession();
  return <p data-testid="session-probe">{`${status}:${user?.email ?? ""}`}</p>;
}

describe("SessionProvider / useSession", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("expone_loading_y_luego_authenticated_cuando_getMe_devuelve_una_sesion_activa", async () => {
    await loginAsSyntheticUser({ email: "sesion-activa@example.test" });

    render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );

    expect(screen.getByTestId("session-probe").textContent).toBe("loading:");

    await waitFor(() => {
      expect(screen.getByTestId("session-probe").textContent).toBe(
        "authenticated:sesion-activa@example.test",
      );
    });
  });

  it("expone_loading_y_luego_anonymous_cuando_getMe_devuelve_401", async () => {
    render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );

    expect(screen.getByTestId("session-probe").textContent).toBe("loading:");

    await waitFor(() => {
      expect(screen.getByTestId("session-probe").textContent).toBe(
        "anonymous:",
      );
    });
  });

  it("limpia_la_sesion_en_memoria_cuando_cualquier_otra_llamada_de_api_recibe_401", async () => {
    await loginAsSyntheticUser({ email: "se-invalida@example.test" });

    render(
      <SessionProvider>
        <SessionProbe />
      </SessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("session-probe").textContent).toBe(
        "authenticated:se-invalida@example.test",
      );
    });

    clearNodeTestSessionCookies();
    const result = await getScanHistory();
    expect(result).toEqual({ ok: false, error: { kind: "unauthorized" } });

    await waitFor(() => {
      expect(screen.getByTestId("session-probe").textContent).toBe(
        "anonymous:",
      );
    });
  });
});
