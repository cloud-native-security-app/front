/**
 * Guard of `/admin` (feature `admin-panel`, AP-02): admin data is never
 * rendered for a non-admin (or unknown role); they are redirected to the
 * scan section. The server remains the authority (403 on the API).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { SessionContext } from "../../src/auth";
import type { SessionState } from "../../src/auth";
import { AdminRoute } from "../../src/routes";

function session(role: "admin" | "user" | undefined): SessionState {
  return {
    status: "authenticated",
    user:
      role === undefined
        ? undefined
        : { sub: "1", email: "a@example.test", name: "A", role },
  };
}

function renderAdmin(state: SessionState) {
  return render(
    <SessionContext.Provider value={state}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <p>Datos de administración</p>
              </AdminRoute>
            }
          />
          <Route path="/escanear" element={<p>Sección escanear</p>} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  );
}

describe("AdminRoute", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders_children_for_an_admin", () => {
    renderAdmin(session("admin"));
    expect(screen.getByText("Datos de administración")).toBeInTheDocument();
  });

  it("redirects_a_regular_user_without_rendering_children", () => {
    renderAdmin(session("user"));
    expect(
      screen.queryByText("Datos de administración"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Sección escanear")).toBeInTheDocument();
  });

  it("redirects_when_the_role_is_unknown", () => {
    renderAdmin(session(undefined));
    expect(
      screen.queryByText("Datos de administración"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Sección escanear")).toBeInTheDocument();
  });
});
