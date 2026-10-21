# keyboard-and-live-feedback

- Engram topic: `odd/keyboard-and-live-feedback/tasks` (project: `front`)
- Branch: `feature/keyboard_and_live_feedback` (not created yet)
- Status: planned (2026-10-21, from the post-report UX review)
- Priority: 3

## Objective

Keyboard users move through the app quickly, and everyone notices when a scan finishes, whatever section they are in.

## Problem (observed)

- No skip link; the nav's focus ring is subtle.
- While a scan runs only a text label changes ("Escaneando…"); when it finishes in another section nothing tells the user.

## Tasks

- [ ] KLF-01 "Saltar al contenido" skip link (first focusable element, visible on focus) targeting the section heading.
- [ ] KLF-02 Stronger, consistent `:focus-visible` style for nav links, buttons, selects and inputs (both themes once `theme-and-contrast` lands).
- [ ] KLF-03 Progress indicator while a scan is queued/running (spinner or indeterminate bar, `prefers-reduced-motion` respected, `aria-busy`).
- [ ] KLF-04 Non-blocking notification when the tracked scan finishes ("Escaneo de 10.0.0.5 completado — Ver reporte"), announced via an `aria-live="polite"` region, visible in any section, dismissible.

## Acceptance criteria

- Tab from the page start reaches the skip link first and it jumps to the content; finishing a scan while in Objetivos shows and announces the notification.

## Checks

Strict TDD (Testing Library, Playwright keyboard flows), `npm run verify`.
