/**
 * Test de `App` real (feature `scan_request_form`, id 4 — primera feature
 * que integra `SessionProvider`/`ProtectedRoute` en `App.tsx` real): el
 * `<h1>front</h1>` es visible independientemente del estado de sesión
 * (mismo criterio que el smoke test de `scaffolding`), y el contenido de
 * negocio (`ScanForm`) solo se renderiza una vez autenticado. Contra el
 * servidor de contrato real, nunca mockeando `src/api`.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "../src/App";
import { gatewayBaseUrl } from "../src/api";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "./api/testHelpers";

/** Reemplaza `window.location` por un doble que registra asignaciones a `href` en vez de navegar de verdad (jsdom no implementa navegación real, ver `tests/auth/ProtectedRoute.test.tsx`). */
function stubWindowLocation(): {
  assignedHrefs: string[];
  restore: () => void;
} {
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
  return {
    assignedHrefs,
    restore: () => {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: original,
      });
    },
  };
}

describe("App", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders_the_persistent_heading_and_redirects_to_login_when_anonymous", async () => {
    const location = stubWindowLocation();

    render(<App />);

    expect(screen.getByRole("heading", { name: "front" })).toBeInTheDocument();

    await waitFor(() => {
      expect(location.assignedHrefs).toEqual([
        `${gatewayBaseUrl()}/auth/login`,
      ]);
    });

    location.restore();
  });

  it("renders_the_scan_form_inside_the_protected_route_when_authenticated", async () => {
    await loginAsSyntheticUser();

    render(<App />);

    expect(screen.getByRole("heading", { name: "front" })).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByLabelText("IP o rango a escanear"),
      ).toBeInTheDocument();
    });
  });
});
