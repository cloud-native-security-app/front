/**
 * Test de componente de `NetworkCredentialsManager` (el contenedor real:
 * feature `network_credentials_manager`, id 9) contra el servidor de
 * contrato real (`listNetworkCredentials`/`createNetworkCredential`/
 * `deleteNetworkCredential` de `src/api`, nunca `vi.mock`, mismo patrón que
 * `tests/features/history/HistoryTable.test.tsx`).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createNetworkCredential } from "../../../src/api";
import { NetworkCredentialsManager } from "../../../src/features/credentials";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../../api/testHelpers";

describe("NetworkCredentialsManager", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  async function fillAndSubmit(target: string, user: string, ref: string) {
    await userEvent.type(screen.getByLabelText("IP del objetivo"), target);
    await userEvent.type(screen.getByLabelText("Usuario de red"), user);
    await userEvent.type(screen.getByLabelText("Credencial SSH"), ref);
    await userEvent.click(
      screen.getByRole("button", { name: /agregar credencial/i }),
    );
  }

  it("lista_las_credenciales_existentes_al_montar", async () => {
    await loginAsSyntheticUser();
    await createNetworkCredential({
      target_pattern: "10.2.0.1",
      network_user: "root",
      ssh_credentials_ref: "vault://ssh/lab-key",
      has_sudo: true,
    });

    render(<NetworkCredentialsManager />);

    await waitFor(() => {
      expect(screen.getByText("10.2.0.1")).toBeInTheDocument();
    });
  });

  it("crear_una_credencial_refresca_el_listado_sin_recargar_la_pagina", async () => {
    await loginAsSyntheticUser();
    render(<NetworkCredentialsManager />);

    await waitFor(() => {
      expect(
        screen.getByText(/todavía no tienes objetivos/i),
      ).toBeInTheDocument();
    });

    await fillAndSubmit("10.2.0.5", "analyst", "vault://ssh/other-key");

    await waitFor(() => {
      expect(screen.getByText("10.2.0.5")).toBeInTheDocument();
    });
  });

  it("borrar_una_credencial_la_quita_del_listado", async () => {
    await loginAsSyntheticUser();
    render(<NetworkCredentialsManager />);
    await fillAndSubmit("10.2.0.9", "root", "vault://ssh/lab-key");
    await waitFor(() => {
      expect(screen.getByText("10.2.0.9")).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Borrar credencial de 10.2.0.9" }),
    );
    expect(screen.getByText("10.2.0.9")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));

    await waitFor(() => {
      expect(screen.queryByText("10.2.0.9")).not.toBeInTheDocument();
    });
  });

  it("guardar_una_credencial_muestra_un_aviso_de_exito_descartable", async () => {
    await loginAsSyntheticUser();
    render(<NetworkCredentialsManager />);
    await waitFor(() => {
      expect(screen.getByText(/todavía no tienes objetivos/i)).toBeVisible();
    });

    await fillAndSubmit("10.2.0.7", "root", "vault://ssh/lab-key");

    const notice = (await screen.findByText("Credencial guardada.")).closest(
      "[role]",
    );
    expect(notice).toHaveAttribute("role", "status");
    expect(notice).not.toHaveAttribute("data-tone", "neutral");

    await userEvent.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(screen.queryByText("Credencial guardada.")).not.toBeInTheDocument();
  });

  it("cancelar_la_confirmacion_conserva_la_credencial_sin_llamar_a_la_api", async () => {
    await loginAsSyntheticUser();
    render(<NetworkCredentialsManager />);
    await fillAndSubmit("10.2.0.8", "root", "vault://ssh/lab-key");
    await screen.findByText("10.2.0.8");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await userEvent.click(
      screen.getByRole("button", { name: "Borrar credencial de 10.2.0.8" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      fetchSpy.mock.calls.some(([, init]) => init?.method === "DELETE"),
    ).toBe(false);
    expect(screen.getByText("10.2.0.8")).toBeInTheDocument();
    fetchSpy.mockRestore();
  });
});

describe("NetworkCredentialsManager row errors (REH-04)", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  async function addCredential(target: string) {
    await userEvent.type(screen.getByLabelText("IP del objetivo"), target);
    await userEvent.type(screen.getByLabelText("Usuario de red"), "root");
    await userEvent.type(
      screen.getByLabelText("Credencial SSH"),
      "vault://ssh/k",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agregar credencial/i }),
    );
    await waitFor(() => {
      expect(screen.getByText(target)).toBeInTheDocument();
    });
  }

  it("a_failed_delete_returns_to_an_actionable_row_when_the_body_read_fails", async () => {
    await loginAsSyntheticUser();
    render(<NetworkCredentialsManager />);
    await addCredential("10.3.0.1");

    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      if (init?.method === "DELETE") {
        return {
          status: 200,
          text: () => Promise.reject(new TypeError("body interrumpido")),
        } as unknown as Response;
      }
      return realFetch(input, init);
    });

    await userEvent.click(
      screen.getByRole("button", { name: "Borrar credencial de 10.3.0.1" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /No pudimos conectar con el servidor/,
    );
    expect(
      screen.getByRole("button", { name: "Borrar credencial de 10.3.0.1" }),
    ).toBeEnabled();
    expect(screen.queryByText("Borrando…")).not.toBeInTheDocument();
  });

  it("a_row_error_clears_after_the_next_successful_delete_of_another_row", async () => {
    await loginAsSyntheticUser();
    render(<NetworkCredentialsManager />);
    await addCredential("10.3.0.2");
    await addCredential("10.3.0.3");

    const realFetch = globalThis.fetch;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        if (init?.method === "DELETE") {
          return {
            status: 500,
            text: () => Promise.resolve("boom"),
          } as unknown as Response;
        }
        return realFetch(input, init);
      });

    await userEvent.click(
      screen.getByRole("button", { name: "Borrar credencial de 10.3.0.2" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    fetchSpy.mockImplementation(realFetch);
    await userEvent.click(
      screen.getByRole("button", { name: "Borrar credencial de 10.3.0.3" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Sí, borrar" }));

    await waitFor(() => {
      expect(screen.queryByText("10.3.0.3")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("10.3.0.2")).toBeInTheDocument();
  });
});
