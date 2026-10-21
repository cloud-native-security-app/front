/**
 * Theme preference (feature `theme-and-contrast`, TAC-02). `system` leaves
 * `<html>` without `data-theme`, so the palette follows the OS through
 * `color-scheme: light dark` (see `src/index.css`); `light` and `dark` force
 * it with `data-theme`. The choice is persisted in `localStorage`, which can
 * throw or be blocked: every access is wrapped and the app works without it.
 */

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

const CYCLE: readonly ThemeChoice[] = ["system", "light", "dark"];

function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

export function readStoredTheme(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(value) ? value : "system";
  } catch {
    return "system";
  }
}

export function storeTheme(choice: ThemeChoice): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage is blocked or full: the choice just lasts for this page view.
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", choice);
  }
}

export function nextTheme(choice: ThemeChoice): ThemeChoice {
  const index = CYCLE.indexOf(choice);
  return CYCLE[(index + 1) % CYCLE.length] ?? "system";
}

/** Applies the persisted choice; safe to call more than once. */
export function initTheme(): void {
  applyTheme(readStoredTheme());
}
