/**
 * Test de componente de `HomePage` (feature `home_landing_page`, id 12):
 * headline, CTA, panel y las 3 líneas de capacidad están presentes. El
 * panel "Escaneo en vivo" es contenido decorativo/simulado (ver
 * `HomePage.tsx`) cuya revelación se anima solo vía CSS
 * (`@media (prefers-reduced-motion: reduce)` en `home.css`) — jsdom no
 * ejecuta animaciones ni media queries de layout, así que las líneas ya
 * están presentes en el DOM independientemente del valor de
 * `prefers-reduced-motion`; este test simula esa preferencia (patrón
 * estándar de mock de `window.matchMedia`) y confirma que el contenido no
 * depende de que ninguna animación termine para ser consultable.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { configureGatewayBaseUrl } from "../../../src/api";
import { HomePage } from "../../../src/features/home";

/** Simula `window.matchMedia` (patrón estándar en jsdom, que no lo implementa) con un `matches` fijo, para las consultas de `prefers-reduced-motion`. */
function mockMatchMedia(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

describe("HomePage", () => {
  beforeEach(() => {
    configureGatewayBaseUrl("http://gateway.contract-test.local");
    mockMatchMedia(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("muestra_el_titular_el_lede_y_el_cta_de_login", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        name: "Analiza infraestructura antes de que alguien más lo haga.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Security Scan App encola el escaneo de una IP, sigue su estado en tiempo real y te muestra los hallazgos — sin paneles que adivinar.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
  });

  it("muestra_las_tres_lineas_de_capacidad", () => {
    render(<HomePage />);

    expect(
      screen.getByText(
        "Encolar — una IP objetivo, validada antes de enviarse.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Verificar — estado en tiempo real, sin recargar la página.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Revisar — hallazgos con su severidad."),
    ).toBeInTheDocument();
  });

  it("muestra_el_panel_de_escaneo_en_vivo_con_su_contenido_visible_bajo_reduced_motion", () => {
    render(<HomePage />);

    expect(screen.getByText("Escaneo en vivo")).toBeInTheDocument();
    expect(
      screen.getByText("10.4.18.12 → 22/tcp abierto ssh"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("10.4.19.6 → 5432/tcp abierto postgresql"),
    ).toBeInTheDocument();
  });

  it("usa_el_nombre_del_producto_y_no_menciona_ni_front_ni_gateway", () => {
    const { container } = render(<HomePage />);

    expect(
      screen.getByText("Security Scan App", { selector: "p" }),
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent(
      /gateway|\bfront\b|exportar|rango/i,
    );
  });
});
