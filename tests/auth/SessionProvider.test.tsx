/**
 * Tests del hook/contexto de sesión (`src/auth`, feature `auth_session`):
 * `loading -> authenticated` / `loading -> anonymous` según la respuesta de
 * `getMe()`, y la limpieza en memoria ante un 401/403 de cualquier otra
 * llamada de `src/api` (criterio 4). Usa el servidor de contrato real
 * in-process (igual que `tests/api/`), nunca mocks de `src/api`.
 */
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { gatewayBaseUrl, getScanHistory } from "../../src/api";
import { SessionProvider, useSession, useSessionRefresh } from "../../src/auth";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../api/testHelpers";

function SessionProbe() {
  const { status, user } = useSession();
  return <p data-testid="session-probe">{`${status}:${user?.email ?? ""}`}</p>;
}

function RefreshProbe() {
  const { status, user } = useSession();
  const refresh = useSessionRefresh();
  return (
    <>
      <p data-testid="role-probe">{`${status}:${user?.role ?? ""}`}</p>
      <button
        type="button"
        onClick={() => {
          void refresh();
        }}
      >
        refresh
      </button>
    </>
  );
}

async function setRole(role: "admin" | "user"): Promise<void> {
  const response = await fetch(`${gatewayBaseUrl()}/__test__/session/role`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  expect(response.status).toBe(204);
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

  describe("refresh", () => {
    async function renderAuthenticated(role: "admin" | "user") {
      await loginAsSyntheticUser({ email: "refresh@example.test", role });
      render(
        <SessionProvider>
          <RefreshProbe />
        </SessionProvider>,
      );
      await waitFor(() => {
        expect(screen.getByTestId("role-probe").textContent).toBe(
          `authenticated:${role}`,
        );
      });
    }

    function clickRefresh(): void {
      act(() => {
        screen.getByRole("button", { name: "refresh" }).click();
      });
    }

    it("downgrades_the_user_when_the_role_was_revoked", async () => {
      await renderAuthenticated("admin");
      await setRole("user");

      clickRefresh();

      await waitFor(() => {
        expect(screen.getByTestId("role-probe").textContent).toBe(
          "authenticated:user",
        );
      });
    });

    it("upgrades_the_user_when_the_role_was_granted", async () => {
      await renderAuthenticated("user");
      await setRole("admin");

      clickRefresh();

      await waitFor(() => {
        expect(screen.getByTestId("role-probe").textContent).toBe(
          "authenticated:admin",
        );
      });
    });

    it("ends_the_session_through_the_unauthorized_path_on_a_401", async () => {
      await renderAuthenticated("admin");
      clearNodeTestSessionCookies();

      clickRefresh();

      await waitFor(() => {
        expect(screen.getByTestId("role-probe").textContent).toBe("anonymous:");
      });
    });

    it("keeps_the_current_user_on_a_network_error_without_retrying", async () => {
      await renderAuthenticated("admin");
      const realFetch = globalThis.fetch;
      const failing = vi
        .fn<typeof fetch>()
        .mockRejectedValue(new TypeError("network down"));
      vi.stubGlobal("fetch", failing);

      try {
        clickRefresh();
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });
      } finally {
        vi.stubGlobal("fetch", realFetch);
      }

      expect(failing).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("role-probe").textContent).toBe(
        "authenticated:admin",
      );
    });
  });
});
