/**
 * Sectioned navigation (feature `sectioned-navigation`, SNV-01/SNV-04):
 * header with brand, section links with `aria-current`, signed-in identity
 * and logout; redirects; landing for anonymous users on any path; focus on
 * the section heading after navigating. Runs the real `App` against the
 * contract server; only the router is injected (`MemoryRouter`).
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
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { submitScan } from "../../src/api";
import { App } from "../../src/App";
import {
  clearNodeTestSessionCookies,
  loginAsSyntheticUser,
  useContractServer,
} from "../api/testHelpers";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

async function sectionHeading(name: string) {
  return screen.findByRole("heading", { level: 2, name });
}

describe("sectioned navigation", () => {
  useContractServer();

  beforeEach(() => {
    clearNodeTestSessionCookies();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows_the_landing_for_any_path_when_anonymous", async () => {
    for (const path of ["/", "/historial", "/objetivos", "/nope"]) {
      renderAt(path);
      expect(
        await screen.findByRole("button", { name: "Iniciar sesión" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
      cleanup();
    }
  });

  it("renders_the_header_with_brand_user_identity_nav_and_logout", async () => {
    await loginAsSyntheticUser({
      name: "Ada Analista",
      email: "ada@example.test",
    });
    renderAt("/escanear");

    const banner = await screen.findByRole("banner");
    expect(
      within(banner).getByRole("heading", {
        level: 1,
        name: "Security Scan App",
      }),
    ).toBeInTheDocument();
    expect(banner).toHaveTextContent("Ada Analista");
    expect(banner).toHaveTextContent("ada@example.test");
    const nav = within(banner).getByRole("navigation", { name: "Secciones" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["Escanear", "Historial", "Objetivos"]);
    expect(
      within(banner).getByRole("button", { name: "Cerrar sesión" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["/escanear", "Escanear"],
    ["/historial", "Historial"],
    ["/objetivos", "Objetivos"],
  ])("marks_the_active_section_link_at_%s", async (path, label) => {
    await loginAsSyntheticUser();
    renderAt(path);

    await sectionHeading(label);
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    const current = within(nav).getAllByRole("link", { current: "page" });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(label);
  });

  it.each(["/", "/nope", "/historial/x/y"])(
    "sends_%s_to_the_scan_section",
    async (path) => {
      await loginAsSyntheticUser();
      renderAt(path);

      await sectionHeading("Escanear");
      expect(
        within(screen.getByRole("navigation", { name: "Secciones" })).getByRole(
          "link",
          { current: "page" },
        ),
      ).toHaveTextContent("Escanear");
    },
  );

  it("shows_only_the_active_section_content", async () => {
    await loginAsSyntheticUser();
    renderAt("/objetivos");

    await sectionHeading("Objetivos");
    expect(screen.getByLabelText("IP del objetivo")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Escanear" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "Historial" }),
    ).not.toBeInTheDocument();
  });

  it("moves_focus_to_the_section_heading_on_navigation", async () => {
    await loginAsSyntheticUser();
    renderAt("/escanear");
    await sectionHeading("Escanear");

    await userEvent.click(screen.getByRole("link", { name: "Historial" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 2, name: "Historial" }),
      ).toHaveFocus(),
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Historial" }),
    ).toHaveAttribute("tabindex", "-1");

    await userEvent.click(screen.getByRole("link", { name: "Objetivos" }));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 2, name: "Objetivos" }),
      ).toHaveFocus(),
    );
  });

  it("opens_a_report_route_inside_history_keeping_history_active", async () => {
    await loginAsSyntheticUser();
    const submitted = await submitScan("10.8.0.1");
    if (!submitted.ok) {
      throw new Error("setup failed");
    }
    renderAt(`/historial/${submitted.value.scanId}`);

    await sectionHeading("Historial");
    expect(
      await screen.findByText(/todavía no ha terminado/i),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("navigation", { name: "Secciones" })).getByRole(
        "link",
        { current: "page" },
      ),
    ).toHaveTextContent("Historial");
  });

  it("shows_the_report_as_its_own_view_with_a_back_link_to_the_history", async () => {
    await loginAsSyntheticUser();
    const submitted = await submitScan("10.8.0.2");
    if (!submitted.ok) {
      throw new Error("setup failed");
    }
    renderAt(`/historial/${submitted.value.scanId}`);

    const back = await screen.findByRole("link", {
      name: "Volver al historial",
    });
    expect(back).toHaveAttribute("href", "/historial");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await userEvent.click(back);

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Volver al historial" }),
    ).not.toBeInTheDocument();
  });
});
