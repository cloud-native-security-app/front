import { beforeEach, describe, expect, it } from "vitest";

import {
  createNetworkCredential,
  deleteNetworkCredential,
  listNetworkCredentials,
} from "../../src/api";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "./testHelpers";

const VALID_INPUT = {
  target_pattern: "192.168.50.10",
  network_user: "root",
  ssh_credentials_ref: "vault://ssh/lab-key",
  has_sudo: true,
};

describe("createNetworkCredential", () => {
  useContractServer();

  beforeEach(async () => {
    clearNodeTestSessionCookies();
    await loginAsSyntheticUser();
  });

  it("crea_una_credencial_y_nunca_devuelve_ssh_credentials_ref", async () => {
    const result = await createNetworkCredential(VALID_INPUT);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.target_pattern).toBe(VALID_INPUT.target_pattern);
      expect(result.value.network_user).toBe(VALID_INPUT.network_user);
      expect(result.value.has_sudo).toBe(true);
      expect(typeof result.value.id).toBe("string");
      expect(result.value.id.length).toBeGreaterThan(0);
      expect("ssh_credentials_ref" in result.value).toBe(false);
    }
  });

  it("mapea_400_a_validation_cuando_el_cuerpo_es_invalido", async () => {
    const result = await createNetworkCredential({
      ...VALID_INPUT,
      network_user: "",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
    }
  });

  it("mapea_401_a_unauthorized_sin_sesion", async () => {
    clearNodeTestSessionCookies();

    const result = await createNetworkCredential(VALID_INPUT);

    expect(result).toEqual({ ok: false, error: { kind: "unauthorized" } });
  });
});

describe("listNetworkCredentials", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  it("lista_las_credenciales_del_usuario_de_la_sesion", async () => {
    await loginAsSyntheticUser();
    await createNetworkCredential(VALID_INPUT);
    await createNetworkCredential({
      ...VALID_INPUT,
      target_pattern: "192.168.50.11",
    });

    const result = await listNetworkCredentials();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
      expect(
        result.value.every((entry) => !("ssh_credentials_ref" in entry)),
      ).toBe(true);
    }
  });

  it("no_mezcla_credenciales_entre_sesiones_distintas", async () => {
    await loginAsSyntheticUser();
    await createNetworkCredential(VALID_INPUT);

    clearNodeTestSessionCookies();
    await loginAsSyntheticUser();
    const result = await listNetworkCredentials();

    expect(result).toEqual({ ok: true, value: [] });
  });

  it("mapea_401_a_unauthorized_sin_sesion", async () => {
    const result = await listNetworkCredentials();

    expect(result).toEqual({ ok: false, error: { kind: "unauthorized" } });
  });
});

describe("deleteNetworkCredential", () => {
  useContractServer();

  beforeEach(async () => {
    clearNodeTestSessionCookies();
    await loginAsSyntheticUser();
  });

  it("borra_una_credencial_existente", async () => {
    const created = await createNetworkCredential(VALID_INPUT);
    if (!created.ok) {
      throw new Error(
        "setup del test falló: createNetworkCredential no fue exitoso",
      );
    }

    const result = await deleteNetworkCredential(created.value.id);

    expect(result).toEqual({ ok: true, value: undefined });
    const afterDelete = await listNetworkCredentials();
    expect(afterDelete).toEqual({ ok: true, value: [] });
  });

  it("mapea_404_a_not_found_para_un_id_inexistente", async () => {
    const result = await deleteNetworkCredential("no-existe");

    expect(result).toEqual({ ok: false, error: { kind: "not_found" } });
  });
});
