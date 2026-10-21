/**
 * "Saltar al contenido" (feature `keyboard-and-live-feedback`, KLF-01): the
 * first focusable element of the authenticated app. Visible only while
 * focused (`.skip-link` in `src/index.css`). Activating it moves focus to the
 * current section heading, falling back to `<main id="main-content">`.
 */

import type { MouseEvent } from "react";

import { SKIP_TO_CONTENT_LABEL } from "../copy";

export const MAIN_CONTENT_ID = "main-content";

export function SkipLink() {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const target =
      document.querySelector<HTMLElement>("[data-section-heading]") ??
      document.getElementById(MAIN_CONTENT_ID);
    target?.focus();
  }

  return (
    <a className="skip-link" href={`#${MAIN_CONTENT_ID}`} onClick={handleClick}>
      {SKIP_TO_CONTENT_LABEL}
    </a>
  );
}
