/**
 * Test de componente de `ScanForm` (feature `scan_request_form`, criterio
 * 6): entrada inválida deshabilita el envío y muestra el error inline sin
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
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ScanEventsSubscription } from "../../../src/api";
import { ScanForm } from "../../../src/features/scan";
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
      screen.getByLabelText("IP a escanear"),
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
      screen.getByLabelText("IP a escanear"),
      "192.168.1.10",
    );

    expect(screen.getByRole("button", { name: /escanear/i })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: /escanear/i }));

    await waitFor(() => {
      // El `scanId` vive en un `<span>` de fuente monoespaciada aparte
      // (feature `scan_console_redesign`, id 13): el texto directo del `<p>`
      // que lo envuelve ya no incluye el espacio final antes del `<span>`
      // (el normalizador por defecto de Testing Library recorta los
      // extremos del texto propio del nodo antes de compararlo, ver
      // `docs/decisions.md`), por eso el matcher ya no
      // exige ese espacio — el comportamiento verificado (aparece el texto
      // "Escaneo encolado. ID:" tras un submit exitoso) no cambia.
      expect(screen.getByText(/escaneo encolado\. id:/i)).toBeInTheDocument();
    });
  });

  it("submit_fallido_muestra_el_error_explicito", async () => {
    // Sin sesión: `submitScan` responde 401, mapeado a `unauthorized`.
    render(<ScanForm />);

    await userEvent.type(
      screen.getByLabelText("IP a escanear"),
      "192.168.1.10",
    );
    await userEvent.click(screen.getByRole("button", { name: /escanear/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /tu sesión ya no es válida/i,
      );
    });
  });

  it("usa_el_placeholder_de_una_sola_ip", () => {
    render(<ScanForm />);

    expect(screen.getByLabelText("IP a escanear")).toHaveAttribute(
      "placeholder",
      "192.168.1.10",
    );
  });

  it("rechaza_un_rango_con_el_mensaje_de_unica_ip", async () => {
    render(<ScanForm />);

    await userEvent.type(screen.getByLabelText("IP a escanear"), "10.0.0.0/24");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Solo se admite una única IP (no rangos).",
    );
    expect(screen.getByRole("button", { name: /escanear/i })).toBeDisabled();
  });

  it("envia_la_ip_sola_cuando_el_usuario_escribe_barra_32", async () => {
    await loginAsSyntheticUser();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<ScanForm />);

    await userEvent.type(screen.getByLabelText("IP a escanear"), "10.9.9.9/32");
    await userEvent.click(screen.getByRole("button", { name: /escanear/i }));

    await waitFor(() => {
      expect(screen.getByText(/escaneo encolado\. id:/i)).toBeInTheDocument();
    });
    const scanCall = fetchSpy.mock.calls.find(([input]) =>
      String(input).endsWith("/api/scans"),
    );
    expect(JSON.parse(String(scanCall?.[1]?.body))).toEqual({
      target: "10.9.9.9",
    });
    fetchSpy.mockRestore();
  });

  it("un_422_sin_credencial_se_explica_sin_mostrar_el_cuerpo_del_servidor", async () => {
    await loginAsSyntheticUser();
    render(<ScanForm />);

    await userEvent.type(
      screen.getByLabelText("IP a escanear"),
      "203.0.113.99",
    );
    await userEvent.click(screen.getByRole("button", { name: /escanear/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Primero agrega una credencial de red para esa IP.",
      );
    });
    expect(screen.getByRole("alert")).not.toHaveTextContent(/gateway|422/i);
  });

  it("muestra_el_estado_final_en_vez_de_desconectado_tras_un_evento_terminal", async () => {
    await loginAsSyntheticUser();
    render(<ScanForm />);

    await userEvent.type(screen.getByLabelText("IP a escanear"), "10.9.9.10");
    await userEvent.click(screen.getByRole("button", { name: /escanear/i }));

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
});
