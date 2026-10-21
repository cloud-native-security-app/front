/**
 * Test de `App` real (feature `scan_request_form`, id 4 — primera feature
 * que integra `SessionProvider`/`ProtectedRoute` en `App.tsx` real): el
 * contenido de negocio (`ScanForm`) solo se renderiza una vez autenticado.
 * Contra el servidor de contrato real, nunca mockeando `src/api`.
 *
 * Ajuste (feature `home_landing_page`, id 12): el caso anónimo ya no
 * redirige automáticamente a login — `ProtectedRoute` renderiza `HomePage`
 * como `anonymousView` (ver `src/App.tsx`), así que el caso anónimo ahora
 * verifica que aparece la página de inicio con su CTA "Iniciar sesión"
 * visible, en vez de una asignación a `window.location.href`. El
 * `<h1>front</h1>` del shell se movió dentro de la rama autenticada (ver
 * comentario de `src/App.tsx`), por eso el caso autenticado también lo
 * verifica ahora.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../src/App";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "./api/testHelpers";

describe("App", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders_the_home_page_with_its_login_cta_when_anonymous", async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "Analiza infraestructura antes de que alguien más lo haga.",
        }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Security Scan App" }),
    ).not.toBeInTheDocument();
  });

  it("renders_the_scan_section_inside_the_protected_route_when_authenticated", async () => {
    await loginAsSyntheticUser();

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { level: 2, name: "Escanear" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Security Scan App" }),
    ).toBeInTheDocument();
  });
});

describe("App error boundary (REH-01)", () => {
  it("shows_the_fallback_instead_of_a_blank_page_when_the_shell_throws", async () => {
    vi.resetModules();
    vi.doMock("../src/features/home", () => ({
      HomePage: () => {
        throw new Error("render roto");
      },
    }));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { App: BrokenApp } = await import("../src/App");

    render(
      <MemoryRouter>
        <BrokenApp />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Algo salió mal.")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
    vi.doUnmock("../src/features/home");
    vi.restoreAllMocks();
    cleanup();
  });
});
