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
      screen.getByRole("button", { name: "Tema: Sistema" }),
    ).toBeInTheDocument();
  });

  it("cycles_system_light_dark_and_sets_data_theme_on_html", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "Tema: Sistema" }));
    expect(html).toHaveAttribute("data-theme", "light");

    await user.click(screen.getByRole("button", { name: "Tema: Claro" }));
    expect(html).toHaveAttribute("data-theme", "dark");

    await user.click(screen.getByRole("button", { name: "Tema: Oscuro" }));
    expect(html).not.toHaveAttribute("data-theme");
    expect(
      screen.getByRole("button", { name: "Tema: Sistema" }),
    ).toBeInTheDocument();
  });

  it("persists_the_choice_and_restores_it_on_startup", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole("button", { name: "Tema: Sistema" }));

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    cleanup();
    html.removeAttribute("data-theme");
    initTheme();
    expect(html).toHaveAttribute("data-theme", "light");
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: "Tema: Claro" }),
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
    await user.click(screen.getByRole("button", { name: "Tema: Sistema" }));

    expect(html).toHaveAttribute("data-theme", "light");
  });
});
