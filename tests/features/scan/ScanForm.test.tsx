/**
 * Feature `sectioned-navigation` (SNV-02): the target is picked from a
 * `<select>` of the user's saved targets instead of typed; with no targets
 * the form points to "Objetivos". Previous contract (feature
 * `scan_request_form`, criterio 6): entrada inválida deshabilita el envío y muestra el error inline sin
 * llamar a `submitScan()`; entrada válida + submit exitoso muestra el
 * `scanId`; submit fallido muestra el error explícito. Contra el servidor
 * de contrato real para `getMe`/`submitScan` (nunca `vi.mock`/`msw` sobre
 * esas llamadas, ver docs/conventions.md).
 *
 * Excepción puntual y documentada: `subscribeToScanEvents` (feature
 * `realtime_status`) sí se sustituye aquí por un stub inerte. Motivo
 * verificado empíricamente en esta sesión: bajo el entorno `jsdom` de este
 * archivo, el polyfill de `EventSource` de `undici`
 * (`e2e/contract-server/nodeTestSession.ts`, feature `api_client`) lanza una
 * excepción no controlable desde userland
 * (`TypeError: The "event" argument must be an instance of Event`) en
 * cuanto la conexión recibe cualquier respuesta real — jsdom reemplaza el
 * `Event` global después de que Node ya fijó su propio `Event` nativo
 * dentro de `dispatchEvent`, y esa referencia nativa no es recuperable
 * desde código de test (confirmado: no se expone vía ningún módulo
 * importable). Es la misma incompatibilidad que documenta
 * `tests/api/scanEvents.test.ts` (entorno "node" vía el pragma de cabecera
 * de ese archivo) — aquí no es aplicable esa solución porque este archivo
 * sí necesita DOM real (`render`/`userEvent`). El comportamiento real de
 * `subscribeToScanEvents`/`useScanEvents` (secuencia de estados, corte de
 * conexión) se verifica sin mocks en
 * `tests/features/scan/useScanEvents.test.ts` (servidor de contrato real,
 * mismo pragma de entorno "node") y en `e2e/realtime-status.spec.ts`
 * (navegador real, sin este problema de `jsdom`).
 */
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ScanEventsSubscription } from "../../../src/api";
import { MemoryRouter } from "react-router-dom";

import { createNetworkCredential } from "../../../src/api";
import { ScanActivityProvider, ScanForm } from "../../../src/features/scan";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../../api/testHelpers";

const subscription = vi.hoisted(() => ({
  onEvent: undefined as ((event: unknown) => void) | undefined,
  onStatusChange: undefined as ((status: string) => void) | undefined,
}));

vi.mock("../../../src/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/api")>();
  return {
    ...actual,
    subscribeToScanEvents: (
      _scanId: string,
      onEvent: (event: unknown) => void,
      onStatusChange: (status: string) => void,
    ): ScanEventsSubscription => {
      subscription.onEvent = onEvent;
      subscription.onStatusChange = onStatusChange;
      onStatusChange("connecting");
      return { close: () => {} };
    },
  };
});

const SELECT_LABEL = "Objetivo a escanear";

async function seedTargets(...targets: string[]): Promise<void> {
  for (const target of targets) {
    const created = await createNetworkCredential({
      target_pattern: target,
      network_user: "root",
      ssh_credentials_ref: "vault://ssh/test-key",
      has_sudo: false,
    });
    if (!created.ok) {
      throw new Error("setup failed: could not seed a target");
    }
  }
}

function renderForm() {
  return render(
    <MemoryRouter>
      <ScanActivityProvider>
        <ScanForm />
      </ScanActivityProvider>
    </MemoryRouter>,
  );
}

async function pickTarget(target: string) {
  await userEvent.selectOptions(
    await screen.findByLabelText(SELECT_LABEL),
    target,
  );
}

describe("ScanForm", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("lists_the_saved_targets_as_options_and_has_no_free_text_input", async () => {
    await loginAsSyntheticUser();
    await seedTargets("10.9.0.1", "10.9.0.2");
    renderForm();

    const select = await screen.findByLabelText(SELECT_LABEL);
    await waitFor(() => {
      expect(
        within(select)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["Selecciona un objetivo", "10.9.0.1", "10.9.0.2"]);
    });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Escanear" })).toBeDisabled();
  });

  it("shows_a_loading_notice_while_targets_load", async () => {
    await loginAsSyntheticUser();
    renderForm();

    expect(screen.getByText("Cargando objetivos…")).toBeInTheDocument();
    await screen.findByText(/agrega un objetivo/i);
  });

  it("points_to_objetivos_when_there_are_no_saved_targets", async () => {
    await loginAsSyntheticUser();
    renderForm();

    expect(
      await screen.findByText(/Agrega un objetivo para poder escanear\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Objetivos" })).toHaveAttribute(
      "href",
      "/objetivos",
    );
    expect(screen.queryByLabelText(SELECT_LABEL)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Escanear" }),
    ).not.toBeInTheDocument();
  });

  it("shows_a_clear_error_when_targets_cannot_be_loaded", async () => {
    renderForm();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /tu sesión ya no es válida/i,
    );
  });

  it("selecting_a_valid_target_enables_the_submit_and_queues_the_scan", async () => {
    await loginAsSyntheticUser();
    await seedTargets("192.168.1.10");
    renderForm();

    await pickTarget("192.168.1.10");
    expect(screen.getByRole("button", { name: "Escanear" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Escanear" }));

    const notice = await screen.findByText(/escaneo en cola/i);
    expect(notice).not.toHaveAttribute("data-tone", "neutral");
    expect(notice.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it("sends_the_normalized_single_ip_when_the_saved_target_has_slash_32", async () => {
    await loginAsSyntheticUser();
    await seedTargets("10.9.9.9/32");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderForm();

    await pickTarget("10.9.9.9/32");
    await userEvent.click(screen.getByRole("button", { name: "Escanear" }));

    await screen.findByText(/escaneo en cola/i);
    const scanCall = fetchSpy.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith("/api/scans") && init?.method === "POST",
    );
    expect(JSON.parse(String(scanCall?.[1]?.body))).toEqual({
      target: "10.9.9.9",
    });
    fetchSpy.mockRestore();
  });

  it("rejects_a_saved_range_without_calling_submitScan", async () => {
    await loginAsSyntheticUser();
    await seedTargets("10.0.0.0/24");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderForm();

    await pickTarget("10.0.0.0/24");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Solo se admite una única IP (no rangos).",
    );
    expect(screen.getByRole("button", { name: "Escanear" })).toBeDisabled();
    expect(
      fetchSpy.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);
    fetchSpy.mockRestore();
  });

  it("a_422_without_credential_is_explained_without_the_server_body", async () => {
    await loginAsSyntheticUser();
    await seedTargets("203.0.113.99");
    renderForm();

    await pickTarget("203.0.113.99");
    await userEvent.click(screen.getByRole("button", { name: "Escanear" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Primero agrega una credencial de red para esa IP.",
    );
    expect(alert).not.toHaveTextContent(/gateway|422/i);
  });

  it("an_expired_session_on_submit_shows_the_explicit_error", async () => {
    await loginAsSyntheticUser();
    await seedTargets("192.168.1.10");
    renderForm();
    await pickTarget("192.168.1.10");
    clearNodeTestSessionCookies();

    await userEvent.click(screen.getByRole("button", { name: "Escanear" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /tu sesión ya no es válida/i,
      );
    });
  });

  it("shows_the_final_state_instead_of_disconnected_after_a_terminal_event", async () => {
    await loginAsSyntheticUser();
    await seedTargets("10.9.9.10");
    renderForm();

    await pickTarget("10.9.9.10");
    await userEvent.click(screen.getByRole("button", { name: "Escanear" }));

    await waitFor(() => {
      expect(screen.getByText(/^Estado:/)).toHaveTextContent(
        "Estado: En cola (conectando…)",
      );
    });

    act(() => {
      subscription.onEvent?.({ status: "started", correlation_id: "c" });
    });
    expect(screen.getByText(/^Estado:/)).toHaveTextContent("Escaneando…");

    act(() => {
      subscription.onEvent?.({
        status: "completed",
        correlation_id: "c",
        result: {},
      });
      subscription.onStatusChange?.("closed");
    });
    const line = screen.getByText(/^Estado:/);
    expect(line).toHaveTextContent("Estado: Completado");
    expect(line).not.toHaveTextContent(/desconectado|sin conexión|\(/);
  });
  it("shows_a_labelled_busy_progress_indicator_only_while_queued_or_running", async () => {
    await loginAsSyntheticUser();
    await seedTargets("10.9.9.11");
    renderForm();

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    await pickTarget("10.9.9.11");
    await userEvent.click(screen.getByRole("button", { name: "Escanear" }));

    const progress = await screen.findByRole("progressbar", {
      name: "Escaneo en curso",
    });
    expect(progress).not.toHaveAttribute("aria-valuenow");
    expect(progress.closest("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByText(/^Estado:/)).toHaveTextContent("En cola");

    act(() => {
      subscription.onEvent?.({ status: "started", correlation_id: "c" });
    });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    act(() => {
      subscription.onEvent?.({
        status: "completed",
        correlation_id: "c",
        result: {},
      });
    });
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText(/^Estado:/).closest("[aria-busy]")).toHaveAttribute(
      "aria-busy",
      "false",
    );
  });
});
