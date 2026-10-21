/**
 * Theme toggle (feature `theme-and-contrast`, TAC-02): follows the OS by
 * default, cycles system -> light -> dark, sets `data-theme` on <html>,
 * persists the choice and keeps working when storage throws.
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  THEME_STORAGE_KEY,
  ThemeToggle,
  initTheme,
  readStoredTheme,
} from "../../src/theme";

const html = document.documentElement;

beforeEach(() => {
  window.localStorage.clear();
  html.removeAttribute("data-theme");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ThemeToggle", () => {
  it("defaults_to_the_os_preference_without_forcing_a_theme", () => {
    render(<ThemeToggle />);

    expect(html).not.toHaveAttribute("data-theme");
    expect(
      screen.getByRole("button", { name: "Tema: sistema. Cambiar." }),
    ).toBeInTheDocument();
  });

  it("cycles_system_light_dark_and_sets_data_theme_on_html", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(
      screen.getByRole("button", { name: "Tema: sistema. Cambiar." }),
    );
    expect(html).toHaveAttribute("data-theme", "light");

    await user.click(
      screen.getByRole("button", { name: "Tema: claro. Cambiar." }),
    );
    expect(html).toHaveAttribute("data-theme", "dark");

    await user.click(
      screen.getByRole("button", { name: "Tema: oscuro. Cambiar." }),
    );
    expect(html).not.toHaveAttribute("data-theme");
    expect(
      screen.getByRole("button", { name: "Tema: sistema. Cambiar." }),
    ).toBeInTheDocument();
  });

  it("persists_the_choice_and_restores_it_on_startup", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(
      screen.getByRole("button", { name: "Tema: sistema. Cambiar." }),
    );

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    cleanup();
    html.removeAttribute("data-theme");
    initTheme();
    expect(html).toHaveAttribute("data-theme", "light");
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: "Tema: claro. Cambiar." }),
    ).toBeInTheDocument();
  });

  it("ignores_an_unknown_stored_value", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");

    expect(readStoredTheme()).toBe("system");
  });

  it("still_renders_and_toggles_when_localstorage_throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const user = userEvent.setup();

    expect(() => initTheme()).not.toThrow();
    render(<ThemeToggle />);
    await user.click(
      screen.getByRole("button", { name: "Tema: sistema. Cambiar." }),
    );

    expect(html).toHaveAttribute("data-theme", "light");
  });

  it("renders_an_icon_only_button_with_a_title_and_hidden_svg", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button", {
      name: "Tema: sistema. Cambiar.",
    });

    expect(button).toHaveAttribute("title", "Tema: sistema. Cambiar.");
    expect(button).toHaveTextContent("");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
