/**
 * Fixed-size icon button that cycles the theme: system -> light -> dark.
 * The icon is decorative; the accessible name comes from `aria-label`
 * ("Tema: claro. Cambiar."). A constant size keeps the header row stable.
 */

import { useState } from "react";

import { themeToggleLabel } from "../copy";
import {
  applyTheme,
  nextTheme,
  readStoredTheme,
  storeTheme,
  type ThemeChoice,
} from "./theme";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false",
} as const;

function ThemeIcon({ choice }: { choice: ThemeChoice }) {
  if (choice === "light") {
    return (
      <svg {...ICON_PROPS}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (choice === "dark") {
    return (
      <svg {...ICON_PROPS}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>(readStoredTheme);

  function cycle() {
    const next = nextTheme(choice);
    applyTheme(next);
    storeTheme(next);
    setChoice(next);
  }

  const label = themeToggleLabel(choice);

  return (
    <button
      type="button"
      className="button--secondary theme-toggle"
      aria-label={label}
      title={label}
      onClick={cycle}
    >
      <ThemeIcon choice={choice} />
    </button>
  );
}
