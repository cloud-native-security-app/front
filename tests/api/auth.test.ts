import { beforeEach, describe, expect, it } from "vitest";

import { getMe, gatewayBaseUrl, loginRedirectUrl } from "../../src/api";
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
