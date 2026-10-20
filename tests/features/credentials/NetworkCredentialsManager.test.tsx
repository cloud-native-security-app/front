/**
 * Test de componente de `NetworkCredentialsManager` (el contenedor real:
 * feature `network_credentials_manager`, id 9) contra el servidor de
 * contrato real (`listNetworkCredentials`/`createNetworkCredential`/
 * `deleteNetworkCredential` de `src/api`, nunca `vi.mock`, mismo patrón que
 * `tests/features/history/HistoryTable.test.tsx`).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
    await userEvent.type(
      screen.getByLabelText("IP o rango del objetivo"),
      target,
    );
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
        screen.getByText(/todavía no hay credenciales/i),
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

    await waitFor(() => {
      expect(screen.queryByText("10.2.0.9")).not.toBeInTheDocument();
    });
  });
});
