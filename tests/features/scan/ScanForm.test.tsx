/**
 * Test de componente de `ScanForm` (feature `scan_request_form`, criterio
 * 6): entrada inválida deshabilita el envío y muestra el error inline sin
 * llamar a `submitScan()`; entrada válida + submit exitoso muestra el
 * `scanId`; submit fallido muestra el error explícito. Contra el servidor
 * de contrato real (nunca `vi.mock`/`msw` sobre `src/api`, ver
 * docs/conventions.md).
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ScanForm } from "../../../src/features/scan";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../../api/testHelpers";

describe("ScanForm", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("deshabilita_el_envio_y_muestra_el_error_inline_sin_llamar_a_submitScan_con_entrada_invalida", async () => {
    await loginAsSyntheticUser();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ScanForm />);

    await userEvent.type(
      screen.getByLabelText("IP o rango a escanear"),
      "192.168.1.999",
    );

    expect(screen.getByRole("button", { name: /escanear/i })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/fuera de rango/i);

    await userEvent.click(screen.getByRole("button", { name: /escanear/i }));
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("entrada_valida_y_submit_exitoso_muestra_el_scanId", async () => {
    await loginAsSyntheticUser();
    render(<ScanForm />);

    await userEvent.type(
      screen.getByLabelText("IP o rango a escanear"),
      "192.168.1.10",
    );

    expect(screen.getByRole("button", { name: /escanear/i })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: /escanear/i }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        /escaneo encolado\. id: /i,
      );
    });
  });

  it("submit_fallido_muestra_el_error_explicito", async () => {
    // Sin sesión: `submitScan` responde 401, mapeado a `unauthorized`.
    render(<ScanForm />);

    await userEvent.type(
      screen.getByLabelText("IP o rango a escanear"),
      "192.168.1.10",
    );
    await userEvent.click(screen.getByRole("button", { name: /escanear/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /tu sesión ya no es válida/i,
      );
    });
  });
});
