/**
 * Network ("IP only") scan mode in `src/api`: `GET /api/me` exposes
 * `can_network_scan`, `submitScan` sends `mode` only for `network`, and the
 * 403/503/422 bodies of the Gateway map to their own typed errors (a 403 here
 * is NOT a session failure, so it must never fire the unauthorized channel).
 * Runs against the real contract server.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMe,
  getScanHistory,
  onUnauthorized,
  submitScan,
} from "../../src/api";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "./testHelpers";

describe("network scan mode", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  it("getMe_expone_can_network_scan_y_es_false_por_defecto", async () => {
    await loginAsSyntheticUser();
    const regular = await getMe();
    expect(regular.ok && regular.value.can_network_scan).toBe(false);

    clearNodeTestSessionCookies();
    await loginAsSyntheticUser({ can_network_scan: true });
    const allowed = await getMe();
    expect(allowed.ok && allowed.value.can_network_scan).toBe(true);
  });

  it("submitScan_en_modo_network_encola_y_el_historico_lo_marca", async () => {
    await loginAsSyntheticUser({ can_network_scan: true });

    const result = await submitScan("192.0.2.10", "network");
    expect(result.ok).toBe(true);
    await submitScan("192.0.2.11");

    const history = await getScanHistory();
    expect(history.ok).toBe(true);
    if (history.ok) {
      const modes = Object.fromEntries(
        history.value.map((entry) => [entry.target, entry.mode]),
      );
      expect(modes).toEqual({ "192.0.2.10": "network", "192.0.2.11": "ssh" });
    }
  });

  it("modo_network_sin_permiso_es_network_scan_not_permitted_y_no_cierra_la_sesion", async () => {
    await loginAsSyntheticUser();
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);

    const result = await submitScan("192.0.2.10", "network");
    unsubscribe();

    expect(result).toEqual({
      ok: false,
      error: { kind: "network_scan_not_permitted" },
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it("503_de_permiso_no_disponible_es_network_scan_unavailable", async () => {
    await loginAsSyntheticUser({ can_network_scan: true });

    const result = await submitScan("192.0.2.50", "network");

    expect(result).toEqual({
      ok: false,
      error: { kind: "network_scan_unavailable" },
    });
  });

  it("422_con_motivo_es_network_scan_target_rejected", async () => {
    await loginAsSyntheticUser({ can_network_scan: true });

    const result = await submitScan("127.0.0.1", "network");

    expect(result).toEqual({
      ok: false,
      error: {
        kind: "network_scan_target_rejected",
        reason: "target_loopback",
      },
    });
  });

  it("422_sin_credencial_en_modo_ssh_sigue_siendo_unexpected_422", async () => {
    await loginAsSyntheticUser();

    const result = await submitScan("203.0.113.99");

    expect(result).toEqual({
      ok: false,
      error: { kind: "unexpected", status: 422 },
    });
  });
});
