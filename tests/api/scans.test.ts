import { beforeEach, describe, expect, it } from "vitest";

import { cancelScan, getScanHistory, submitScan } from "../../src/api";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "./testHelpers";

describe("submitScan", () => {
  useContractServer();

  beforeEach(async () => {
    clearNodeTestSessionCookies();
    await loginAsSyntheticUser();
  });

  it("encola_un_escaneo_y_devuelve_el_scanId", async () => {
    const result = await submitScan("192.168.1.10");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.value.scanId).toBe("string");
      expect(result.value.scanId.length).toBeGreaterThan(0);
    }
  });

  it("mapea_400_a_validation_cuando_el_target_esta_vacio", async () => {
    const result = await submitScan("");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
    }
  });

  it("mapea_401_a_unauthorized_sin_sesion", async () => {
    clearNodeTestSessionCookies();

    const result = await submitScan("192.168.1.10");

    expect(result).toEqual({ ok: false, error: { kind: "unauthorized" } });
  });
});

describe("getScanHistory", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  it("lista_los_escaneos_del_usuario_de_la_sesion", async () => {
    await loginAsSyntheticUser();
    await submitScan("10.0.0.5");
    await submitScan("10.0.0.6");

    const result = await getScanHistory();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(result.value.map((entry) => entry.target).sort()).toEqual([
        "10.0.0.5",
        "10.0.0.6",
      ]);
      expect(result.value[0]?.status).toBe("PENDIENTE");
    }
  });

  it("includes_a_null_failure_reason_for_non_failed_scans", async () => {
    await loginAsSyntheticUser();
    await submitScan("10.0.0.7");

    const result = await getScanHistory();

    expect(result.ok && result.value[0]?.failure_reason).toBeNull();
  });

  it("mapea_401_a_unauthorized_sin_sesion", async () => {
    const result = await getScanHistory();

    expect(result).toEqual({ ok: false, error: { kind: "unauthorized" } });
  });
});

describe("cancelScan", () => {
  useContractServer();

  beforeEach(async () => {
    clearNodeTestSessionCookies();
    await loginAsSyntheticUser();
  });

  it("cancela_un_escaneo_pendiente", async () => {
    const submitted = await submitScan("10.0.0.7");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }

    const result = await cancelScan(submitted.value.scanId);

    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("mapea_404_a_not_found_para_un_scanId_inexistente", async () => {
    const result = await cancelScan("no-existe");

    expect(result).toEqual({ ok: false, error: { kind: "not_found" } });
  });

  it("mapea_409_a_conflict_si_el_escaneo_ya_es_terminal", async () => {
    const submitted = await submitScan("10.0.0.fail");
    if (!submitted.ok) {
      throw new Error("setup del test falló: submitScan no fue exitoso");
    }
    const firstCancel = await cancelScan(submitted.value.scanId);
    expect(firstCancel.ok).toBe(true);

    const result = await cancelScan(submitted.value.scanId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("conflict");
    }
  });

  it("marks_a_cancelled_scan_CANCELADO_with_a_reason_and_rejects_a_second_cancel", async () => {
    await loginAsSyntheticUser();
    const submitted = await submitScan("10.0.0.8");
    if (!submitted.ok) {
      throw new Error("setup failed");
    }
    await cancelScan(submitted.value.scanId);

    const history = await getScanHistory();
    expect(history.ok).toBe(true);
    if (history.ok) {
      const entry = history.value.find(
        (e) => e.scanId === submitted.value.scanId,
      );
      expect(entry?.status).toBe("CANCELADO");
      expect(entry?.failure_reason).toEqual(expect.any(String));
    }
    const again = await cancelScan(submitted.value.scanId);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.error.kind).toBe("conflict");
    }
  });
});
