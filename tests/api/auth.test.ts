import { beforeEach, describe, expect, it } from "vitest";

import { getMe, gatewayBaseUrl, loginRedirectUrl, logout } from "../../src/api";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "./testHelpers";

describe("loginRedirectUrl", () => {
  useContractServer();

  it("apunta_a_la_ruta_de_login_del_gateway_configurado", () => {
    expect(loginRedirectUrl()).toBe(`${gatewayBaseUrl()}/auth/login`);
  });
});

describe("getMe", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  it("devuelve_el_perfil_cuando_hay_sesion_activa", async () => {
    const identity = {
      email: "test-user-1@example.test",
      name: "Analista Uno",
    };
    await loginAsSyntheticUser(identity);

    const result = await getMe();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBe(identity.email);
      expect(result.value.name).toBe(identity.name);
      expect(typeof result.value.sub).toBe("string");
    }
  });

  it("mapea_401_a_unauthorized_cuando_no_hay_sesion", async () => {
    const result = await getMe();

    expect(result).toEqual({ ok: false, error: { kind: "unauthorized" } });
  });
});

describe("logout", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  it("invalida_la_sesion_activa_y_getMe_devuelve_unauthorized_despues", async () => {
    await loginAsSyntheticUser({
      email: "logout-user@example.test",
      name: "Analista Logout",
    });

    const result = await logout();

    expect(result).toEqual({ ok: true, value: undefined });

    const afterLogout = await getMe();
    expect(afterLogout).toEqual({
      ok: false,
      error: { kind: "unauthorized" },
    });
  });

  it("responde_ok_incluso_sin_sesion_activa_mismo_criterio_que_el_gateway_real", async () => {
    const result = await logout();

    expect(result).toEqual({ ok: true, value: undefined });
  });
});
