/**
 * Test de componente de `NetworkCredentialForm` (feature
 * `network_credentials_manager`, criterio de tests de componente): entrada
 * incompleta deshabilita el envío; submit exitoso llama a `onCreated` con la
 * credencial devuelta (nunca con `ssh_credentials_ref`, que ni siquiera
 * viaja en la respuesta); submit fallido muestra el error explícito. Contra
 * el servidor de contrato real (nunca `vi.mock` de `src/api`, ver
 * docs/verification.md).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NetworkCredentialForm } from "../../../src/features/credentials";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../../api/testHelpers";

describe("NetworkCredentialForm", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("deshabilita_el_envio_mientras_falten_campos_requeridos", async () => {
    // userEvent.setup({ delay: null }) evita que estos asserts dependan de
    // la velocidad de la máquina: por defecto userEvent.type espera un
    // pequeño delay entre cada letra, lo que puede superar el timeout de
    // 5 s de Vitest cuando la suite corre en paralelo (ver feature
    // stabilize_network_credential_form_tests).
    const user = userEvent.setup({ delay: null });
    await loginAsSyntheticUser();
    render(<NetworkCredentialForm onCreated={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: /agregar credencial/i }),
    ).toBeDisabled();

    await user.type(
      screen.getByLabelText("IP o rango del objetivo"),
      "192.168.1.10",
    );
    expect(
      screen.getByRole("button", { name: /agregar credencial/i }),
    ).toBeDisabled();

    await user.type(screen.getByLabelText("Usuario de red"), "root");
    expect(
      screen.getByRole("button", { name: /agregar credencial/i }),
    ).toBeDisabled();

    await user.type(
      screen.getByLabelText("Credencial SSH"),
      "vault://ssh/lab-key",
    );
    expect(
      screen.getByRole("button", { name: /agregar credencial/i }),
    ).toBeEnabled();
  });

  it("submit_exitoso_llama_a_onCreated_con_la_credencial_devuelta_y_limpia_el_formulario", async () => {
    // Mismo motivo que el test anterior: delay: null quita la dependencia
    // de la velocidad de la máquina.
    const user = userEvent.setup({ delay: null });
    await loginAsSyntheticUser();
    const onCreated = vi.fn();
    render(<NetworkCredentialForm onCreated={onCreated} />);

    await user.type(
      screen.getByLabelText("IP o rango del objetivo"),
      "192.168.1.10",
    );
    await user.type(screen.getByLabelText("Usuario de red"), "root");
    await user.type(
      screen.getByLabelText("Credencial SSH"),
      "vault://ssh/lab-key",
    );
    await user.click(
      screen.getByRole("button", { name: /agregar credencial/i }),
    );

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
    const created: unknown = onCreated.mock.calls[0]?.[0];
    expect(created).toMatchObject({
      target_pattern: "192.168.1.10",
      network_user: "root",
    });
    expect(created).not.toHaveProperty("ssh_credentials_ref");

    expect(screen.getByLabelText("IP o rango del objetivo")).toHaveValue("");
    expect(screen.getByLabelText("Usuario de red")).toHaveValue("");
    expect(screen.getByLabelText("Credencial SSH")).toHaveValue("");
  });

  it("el_campo_de_credencial_ssh_es_de_tipo_password", () => {
    render(<NetworkCredentialForm onCreated={vi.fn()} />);

    expect(screen.getByLabelText("Credencial SSH")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("submit_fallido_muestra_el_error_explicito", async () => {
    // Sin sesión: createNetworkCredential responde 401, mapeado a unauthorized.
    render(<NetworkCredentialForm onCreated={vi.fn()} />);

    await userEvent.type(
      screen.getByLabelText("IP o rango del objetivo"),
      "192.168.1.10",
    );
    await userEvent.type(screen.getByLabelText("Usuario de red"), "root");
    await userEvent.type(
      screen.getByLabelText("Credencial SSH"),
      "vault://ssh/lab-key",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /agregar credencial/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /tu sesión ya no es válida/i,
      );
    });
  });
});
