/**
 * Test de componente de `LoginButton` (feature `auth_session`, criterio
 * 3): al hacer click, navega (asignación de `window.location.href`) a la
 * URL de login del Gateway, y nunca hace un `fetch`.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { configureGatewayBaseUrl, gatewayBaseUrl } from "../../src/api";
import { LoginButton } from "../../src/auth";

describe("LoginButton", () => {
  beforeAll(() => {
    configureGatewayBaseUrl("http://gateway.contract-test.local");
  });

  afterEach(() => {
    configureGatewayBaseUrl("http://gateway.contract-test.local");
  });

  it("navega_a_la_url_de_login_del_gateway_al_hacer_click_sin_usar_fetch", async () => {
    const original = window.location;
    const assignedHrefs: string[] = [];
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...original,
        set href(value: string) {
          assignedHrefs.push(value);
        },
        get href() {
          return original.href;
        },
      },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<LoginButton />);
    await userEvent.click(
      screen.getByRole("button", { name: /iniciar sesión/i }),
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(assignedHrefs).toEqual([`${gatewayBaseUrl()}/auth/login`]);

    fetchSpy.mockRestore();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: original,
    });
  });
});
