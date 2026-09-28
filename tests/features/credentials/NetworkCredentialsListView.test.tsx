/**
 * Test de componente de `NetworkCredentialsListView` (presentacional, mismo
 * criterio que `HistoryTableView.test.tsx`): muestra
 * target_pattern/network_user/has_sudo por fila, nunca
 * `ssh_credentials_ref` (el tipo `NetworkCredential` ni siquiera lo tiene),
 * y muestra/oculta el botón de borrar según el estado de la fila. Sin red,
 * sin mockear `src/api`.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NetworkCredential } from "../../../src/api";
import {
  NetworkCredentialsListView,
  type RowDeleteState,
} from "../../../src/features/credentials";

const BASE_ENTRIES: NetworkCredential[] = [
  {
    id: "cred-1",
    user_id: "user-1",
    target_pattern: "10.0.0.1",
    network_user: "root",
    has_sudo: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cred-2",
    user_id: "user-1",
    target_pattern: "10.0.0.2/24",
    network_user: "analyst",
    has_sudo: false,
    created_at: "2026-01-01T00:01:00.000Z",
    updated_at: "2026-01-01T00:01:00.000Z",
  },
];

describe("NetworkCredentialsListView", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra_target_pattern_network_user_y_has_sudo_de_cada_entrada", () => {
    render(
      <NetworkCredentialsListView
        entries={BASE_ENTRIES}
        rowStates={{}}
        onDelete={vi.fn()}
      />,
    );

    const rowRoot = screen.getByText("10.0.0.1").closest("tr");
    expect(rowRoot).toHaveTextContent("root");
    expect(rowRoot).toHaveTextContent("Sí");

    const rowNoSudo = screen.getByText("10.0.0.2/24").closest("tr");
    expect(rowNoSudo).toHaveTextContent("analyst");
    expect(rowNoSudo).toHaveTextContent("No");
  });

  it("nunca_renderiza_ssh_credentials_ref", () => {
    const { container } = render(
      <NetworkCredentialsListView
        entries={BASE_ENTRIES}
        rowStates={{}}
        onDelete={vi.fn()}
      />,
    );

    expect(container.textContent).not.toMatch(/ssh_credentials_ref/i);
  });

  it("llama_a_onDelete_con_el_id_de_la_fila_al_hacer_click", async () => {
    const onDelete = vi.fn();
    render(
      <NetworkCredentialsListView
        entries={BASE_ENTRIES}
        rowStates={{}}
        onDelete={onDelete}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Borrar credencial de 10.0.0.1" }),
    );

    expect(onDelete).toHaveBeenCalledWith("cred-1");
  });

  it("deshabilita_el_boton_mientras_la_fila_esta_borrando", () => {
    const rowStates: Record<string, RowDeleteState> = {
      "cred-1": { status: "deleting" },
    };
    render(
      <NetworkCredentialsListView
        entries={BASE_ENTRIES}
        rowStates={rowStates}
        onDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Borrar credencial de 10.0.0.1" }),
    ).toBeDisabled();
  });

  it("muestra_el_error_de_borrado_de_forma_explicita_sin_quitar_la_fila", () => {
    const rowStates: Record<string, RowDeleteState> = {
      "cred-1": {
        status: "error",
        message: "La credencial ya no existe o no pertenece a tu sesión.",
      },
    };
    render(
      <NetworkCredentialsListView
        entries={BASE_ENTRIES}
        rowStates={rowStates}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/ya no existe/i);
    expect(
      screen.getByRole("button", { name: "Borrar credencial de 10.0.0.1" }),
    ).toBeEnabled();
  });

  it("muestra_un_estado_vacio_explicito_cuando_no_hay_entradas", () => {
    render(
      <NetworkCredentialsListView
        entries={[]}
        rowStates={{}}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /todavía no hay credenciales/i,
    );
  });
});
