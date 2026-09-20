/**
 * Test mínimo del scaffolding: verifica que la app monta y renderiza
 * contenido concreto (no un snapshot ciego ni un "no crashea").
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../src/App";

describe("App", () => {
  it("renders_the_scaffolding_placeholder_heading", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "front" })).toBeInTheDocument();
  });
});
