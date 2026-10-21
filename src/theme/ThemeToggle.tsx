/**
 * Button that cycles the theme: system -> light -> dark. Its visible text
 * is also its accessible name ("Tema: Claro"), so it needs no extra ARIA.
 */

import { useState } from "react";

import { THEME_LABEL, themeChoiceLabel } from "../copy";
import {
  applyTheme,
  nextTheme,
  readStoredTheme,
  storeTheme,
  type ThemeChoice,
} from "./theme";

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(readStoredTheme);

  function cycle() {
    const next = nextTheme(choice);
    applyTheme(next);
    storeTheme(next);
    setChoice(next);
  }

  return (
    <button
      type="button"
      className="button--secondary theme-toggle"
      onClick={cycle}
    >
      {THEME_LABEL}: {themeChoiceLabel(choice)}
    </button>
  );
}
