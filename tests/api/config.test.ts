import { afterEach, describe, expect, it } from "vitest";

import { configureGatewayBaseUrl, gatewayBaseUrl } from "../../src/api";

describe("gatewayBaseUrl", () => {
  afterEach(() => {
    configureGatewayBaseUrl(undefined);
  });

  it("usa_el_valor_configurado_explicitamente_para_tests", () => {
    configureGatewayBaseUrl("http://127.0.0.1:9999");

    expect(gatewayBaseUrl()).toBe("http://127.0.0.1:9999");
  });

  it("lanza_un_error_explicito_si_no_hay_configuracion_ni_variable_de_build", () => {
    configureGatewayBaseUrl(undefined);

    // En el proceso de test, `import.meta.env.VITE_GATEWAY_BASE_URL` no
    // está definida salvo que un test la configure explícitamente arriba
    // — este es exactamente el escenario que debe fallar con un mensaje
    // claro en vez de silenciosamente construir una URL "undefined/...".
    expect(() => gatewayBaseUrl()).toThrow(/VITE_GATEWAY_BASE_URL/);
  });
});
