# keyboard-and-live-feedback

- Engram topic: `odd/keyboard-and-live-feedback/tasks` (project: `front`)
- Branch: `feature/keyboard_live_feedback`
- Status: implemented, uncommitted (2026-10-21)
- Priority: 3

## Objective

Keyboard users move through the app quickly, and everyone notices when a scan finishes, whatever section they are in.

## Problem (observed)

- No skip link; the nav's focus ring is subtle.
- While a scan runs only a text label changes ("Escaneando…"); when it finishes in another section nothing tells the user.

## Tasks

- [x] KLF-01 "Saltar al contenido" skip link (first focusable element, visible on focus) targeting the section heading.
- [x] KLF-02 Stronger, consistent `:focus-visible` style for nav links, buttons, selects and inputs (both themes once `theme-and-contrast` lands).
- [x] KLF-03 Progress indicator while a scan is queued/running (spinner or indeterminate bar, `prefers-reduced-motion` respected, `aria-busy`).
- [x] KLF-04 Non-blocking notification when the tracked scan finishes ("Escaneo de 10.0.0.5 completado — Ver reporte"), announced via an `aria-live="polite"` region, visible in any section, dismissible.

## Acceptance criteria

- Tab from the page start reaches the skip link first and it jumps to the content; finishing a scan while in Objetivos shows and announces the notification.

## Checks

Strict TDD (Testing Library, Playwright keyboard flows), `npm run verify`.

## Evidence

- Route: delegated direct, one writer, strict TDD (vitest + Testing Library).
- RED (new/changed tests before implementation): `SkipLink.test.tsx` and `ScanFinishedNotice.test.tsx` failed on missing modules, `focusVisible.test.ts` 2 failed, `ScanForm.test.tsx` progress test 1 failed: 4 files failed, 9 tests failed, 10 passed.
- GREEN: `CI=true npm run verify` exit 0; vitest 44 files / 236 tests passed; Playwright 37 passed (incl. the new `e2e/keyboard-feedback.spec.ts` and the axe `color-contrast` specs in both themes).
- KLF-01: `SkipLink` (first element in `AuthenticatedRoutes`), `href="#main-content"` plus onClick that focuses `[data-section-heading]`, falling back to `<main id="main-content" tabIndex={-1}>`.
- KLF-02: the global `:focus-visible` rule in `src/index.css` now also covers `select` and `textarea` (3px `--color-accent` outline, 2px offset; theme-aware via `light-dark()`).
- KLF-03: indeterminate `role="progressbar"` bar (labelled "Escaneo en curso") in `ScanForm`; wrapper `aria-busy` true only for PENDIENTE/EN_PROGRESO; static bar under `prefers-reduced-motion`.
- KLF-04 decision: provider/context minimally extended (`target` in context, `trackScan(scanId, target?)`; ScanForm passes the validated target), so the message is "Escaneo de <target> completado — Ver reporte"; target omitted when unknown. FALLIDO/CANCELADO show "falló"/"cancelado" with no report link. Always-rendered `role="status" aria-live="polite"` region; dismissal is per scan id.
- Deviation: no e2e for the notification flow (covered by unit tests on the context value); the skip-link e2e waits for the heading before pressing Tab.
