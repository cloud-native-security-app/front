/**
 * Scan form, IP-only mode (feature `network_scan_mode`, NS-04): the mode
 * choice exists only for accounts the Gateway marks `can_network_scan`; IP
 * only asks for nothing but the IP and says the patch state is not verified;
 * the request carries `mode: "network"` only in that mode. Real contract
 * server, real `SessionProvider`; `subscribeToScanEvents` is stubbed for the
 * reason documented in `ScanForm.test.tsx`.
 */
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createNetworkCredential,
  getScanHistory,
  type ScanEventsSubscription,
} from "../../../src/api";
import { SessionProvider } from "../../../src/auth";
import { ScanActivityProvider, ScanForm } from "../../../src/features/scan";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../../api/testHelpers";

vi.mock("../../../src/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/api")>();
  return {
    ...actual,
    subscribeToScanEvents: (
      _scanId: string,
      _onEvent: (event: unknown) => void,
      onStatusChange: (status: string) => void,
    ): ScanEventsSubscription => {
      onStatusChange("connecting");
      return { close: () => {} };
    },
  };
});

const GROUP_NAME = "Modo de escaneo";
const SSH_RADIO = "Con credenciales SSH";
const NETWORK_RADIO = "Solo con la IP";

function renderForm() {
  return render(
    <SessionProvider>
      <MemoryRouter>
        <ScanActivityProvider>
          <ScanForm />
        </ScanActivityProvider>
      </MemoryRouter>
    </SessionProvider>,
  );
}

async function chooseNetworkMode() {
  await userEvent.click(
    await screen.findByRole("radio", { name: NETWORK_RADIO }),
  );
}

async function submitIp(ip: string) {
  await userEvent.type(await screen.findByLabelText("IP a escanear"), ip);
  await userEvent.click(screen.getByRole("button", { name: "Escanear" }));
}

describe("ScanForm network mode", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("hides_the_mode_choice_when_the_account_cannot_network_scan", async () => {
    await loginAsSyntheticUser();
    renderForm();

    await screen.findByText(/Agrega un objetivo para poder escanear\./);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByText(NETWORK_RADIO)).not.toBeInTheDocument();
  });

  it("shows_an_accessible_radio_group_with_ssh_selected_by_default", async () => {
    await loginAsSyntheticUser({ can_network_scan: true });
    renderForm();

    const group = await screen.findByRole("radiogroup", { name: GROUP_NAME });
    expect(group.tagName).toBe("FIELDSET");
    expect(within(group).getByRole("radio", { name: SSH_RADIO })).toBeChecked();
    expect(
      within(group).getByRole("radio", { name: NETWORK_RADIO }),
    ).not.toBeChecked();
  });

  it("radios_work_with_the_keyboard", async () => {
    await loginAsSyntheticUser({ can_network_scan: true });
    renderForm();

    const ssh = await screen.findByRole("radio", { name: SSH_RADIO });
    ssh.focus();
    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getByRole("radio", { name: NETWORK_RADIO })).toBeChecked();
    expect(screen.getByRole("radio", { name: NETWORK_RADIO })).toHaveFocus();
  });

  it("ip_only_asks_only_for_the_ip_and_explains_the_unverified_patch_state", async () => {
    await loginAsSyntheticUser({ can_network_scan: true });
    renderForm();
    await chooseNetworkMode();

    expect(await screen.findByLabelText("IP a escanear")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Objetivo a escanear"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Solo necesitas la IP/)).toBeInTheDocument();
    expect(screen.getByText(/no se verifica/)).toBeInTheDocument();
    // No credential setup prompt in this mode, even with no saved targets.
    expect(screen.queryByText(/Agrega un objetivo/)).not.toBeInTheDocument();
  });

  it("ip_only_sends_mode_network_and_the_history_records_it", async () => {
    await loginAsSyntheticUser({ can_network_scan: true });
    renderForm();
    await chooseNetworkMode();

    await submitIp("192.0.2.10");

    expect(await screen.findByText(/escaneo en cola/i)).toBeInTheDocument();
    const history = await getScanHistory();
    expect(history.ok && history.value.map((e) => [e.target, e.mode])).toEqual([
      ["192.0.2.10", "network"],
    ]);
  });

  it("ssh_mode_keeps_sending_the_original_request", async () => {
    await loginAsSyntheticUser({ can_network_scan: true });
    await createNetworkCredential({
      target_pattern: "10.9.0.1",
      network_user: "root",
      ssh_credentials_ref: "vault://ssh/test-key",
      has_sudo: false,
    });
    renderForm();

    await userEvent.selectOptions(
      await screen.findByLabelText("Objetivo a escanear"),
      "10.9.0.1",
    );
    await userEvent.click(screen.getByRole("button", { name: "Escanear" }));

    await screen.findByText(/escaneo en cola/i);
    const history = await getScanHistory();
    expect(history.ok && history.value[0]?.mode).toBe("ssh");
  });

  it("validates_the_ip_before_sending_in_ip_only_mode", async () => {
    await loginAsSyntheticUser({ can_network_scan: true });
    renderForm();
    await chooseNetworkMode();

    await userEvent.type(
      await screen.findByLabelText("IP a escanear"),
      "999.1.1.1",
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/fuera de rango/i);
    expect(screen.getByRole("button", { name: "Escanear" })).toBeDisabled();
  });

  it("shows_the_reason_when_the_gateway_rejects_the_target", async () => {
    await loginAsSyntheticUser({ can_network_scan: true });
    renderForm();
    await chooseNetworkMode();

    await submitIp("127.0.0.1");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/loopback/i);
    });
  });

  it("switching_mode_clears_the_previous_error", async () => {
    await loginAsSyntheticUser({ can_network_scan: true });
    renderForm();
    await chooseNetworkMode();
    await submitIp("127.0.0.1");
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("radio", { name: SSH_RADIO }));

    expect(screen.queryByText(/loopback/i)).not.toBeInTheDocument();
  });
});
