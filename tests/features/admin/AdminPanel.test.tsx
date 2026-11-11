/** Container of the admin panel (feature `admin-panel`, AP-04). */
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureGatewayBaseUrl } from "../../../src/api";
import { AdminPanel } from "../../../src/features/admin";
import { makeKpis, makeSnapshot } from "./fixtures";

class IdleEventSource {
  addEventListener(): void {}
  close(): void {}
}

const fetchMock = vi.fn<(url: string) => Promise<Response>>();

function renderPanel() {
  return render(
    <MemoryRouter>
      <AdminPanel scanPath="/escanear" />
    </MemoryRouter>,
  );
}

describe("AdminPanel", () => {
  beforeEach(() => {
    configureGatewayBaseUrl("http://gateway.test");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("EventSource", IdleEventSource);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    configureGatewayBaseUrl(undefined);
  });

  it("shows_a_loading_status_then_the_data", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify(makeSnapshot({ kpis: makeKpis({ active_users: 5 }) })),
        { status: 200 },
      ),
    );
    renderPanel();
    expect(
      screen.getByText("Cargando el panel de administración…"),
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("region", { name: "Indicadores" }),
    ).toHaveTextContent("5");
  });

  it("keeps_one_focusable_section_heading_across_loading_and_data", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(makeSnapshot()), { status: 200 }),
    );
    renderPanel();
    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Administración",
    });
    expect(heading).toHaveAttribute("data-section-heading");
    expect(heading).toHaveAttribute("tabindex", "-1");

    await screen.findByRole("region", { name: "Indicadores" });
    expect(
      screen.getByRole("heading", { level: 2, name: "Administración" }),
    ).toBe(heading);
  });

  it("on_403_it_shows_a_clear_message_with_a_way_out_and_no_admin_data", async () => {
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 403 }));
    renderPanel();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tu cuenta ya no tiene permisos de administración",
    );
    expect(
      screen.getByRole("link", { name: "Volver a Escanear" }),
    ).toHaveAttribute("href", "/escanear");
    expect(
      screen.queryByRole("region", { name: "Indicadores" }),
    ).not.toBeInTheDocument();
  });

  it("on_503_it_says_the_role_cannot_be_verified_and_that_it_retries", async () => {
    fetchMock.mockResolvedValueOnce(new Response("no", { status: 503 }));
    renderPanel();

    expect(
      await screen.findByRole("status", { name: "Estado de la conexión" }),
    ).toHaveTextContent(/no pudimos verificar tu rol/i);
  });
});
