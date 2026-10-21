# theme-and-contrast

- Engram topic: `odd/theme-and-contrast/tasks` (project: `front`)
- Branch: `feature/theme_and_contrast` (created)
- Status: implemented, uncommitted (2026-10-21, from the post-report UX review)
- Priority: 2

## Objective

The app honors the user's light/dark preference and every text and control meets WCAG AA contrast.

## Problem (observed)

- Only a dark theme exists; `.home-page` and `.app-shell--authenticated` duplicate the same dark palette by hand (`home.css`, `index.css`); the light `:root` palette is never visible.
- Muted text `#8996ac` on `#131b2c` is around 5:1 at 0.85rem, close to the limit; disabled buttons have low contrast (`index.css` disabled rules).

## Tasks

- [x] TAC-01 Single source of color tokens with a dark and a light set; remove the duplicated palettes.
- [x] TAC-02 Follow `prefers-color-scheme` by default, plus a theme toggle in the header (persisted in `localStorage`, wrapped in try/catch).
- [x] TAC-03 Raise muted text and disabled controls to at least 4.5:1 (text) and 3:1 (UI components) in both themes; document the measured ratios.
- [x] TAC-04 Automated contrast check in e2e (e.g. `@axe-core/playwright` on landing, Escanear, Historial, Objetivos and a report, both themes).

## Acceptance criteria

- No axe color-contrast violations in either theme; the toggle and the OS preference both work.

## Checks

Strict TDD where behavior changes (toggle, persistence), axe in Playwright, `npm run verify`.

## Evidence

Route: delegated direct (one writer). Strict TDD; runners vitest + Playwright.

- TAC-01: tokens declared once in `:root` as `light-dark(light, dark)`; `color-scheme: light dark` follows the OS, `:root[data-theme=light|dark]` forces it. `.home-page` and `.app-shell--authenticated` no longer redeclare any palette; both `::before` fixed layers removed (body paints `--color-bg`). New tokens: `--color-control-border`, `--color-disabled-bg`, `--color-disabled-text`.
- TAC-02: `src/theme` (`theme.ts`, `ThemeToggle.tsx`), button "Tema: Sistema|Claro|Oscuro" cycling system, light, dark; in `AppHeader` and on the landing. `public/theme-init.js` (external, CSP `script-src 'self'`) applies the stored choice before first paint; `initTheme()` in `main.tsx`. Storage access wrapped in try/catch.
  - RED: `tests/theme/ThemeToggle.test.tsx` failed (module `src/theme` missing). GREEN: 5/5.
- TAC-03 measured ratios (WCAG relative luminance):
  - Before: dark muted `#8996ac` on `#131b2c` 5.75, on `#0b1220` 6.26, on disabled bg `#232e45` 4.54; light muted `#5b6472` on `#d8dce2` (disabled bg) 4.35 (fails); input/disabled borders `#232e45` on `#131b2c` about 1.2 (UI).
  - After: dark muted `#a3afc4` on `#0b1220` 8.46 / `#131b2c` 7.77 / `#232e45` 6.13; disabled text `#a9b4c8` on `#232e45` 6.49; control border `#6b7a94` on `#131b2c` 3.96, `#0b1220` 4.31, `#232e45` 3.12. Light muted `#4b5563` on `#ffffff` 7.56 / `#f3f4f6` 6.87 / `#e4e7ec` 6.10; disabled text `#4b5563` on `#e4e7ec` 6.10; control border `#76808f` on `#ffffff` 4.00, `#f3f4f6` 3.63, `#e4e7ec` 3.22.
- TAC-04: `@axe-core/playwright` 4.14.0 (exact), `e2e/contrast.spec.ts`: landing, Escanear, Historial, Objetivos, open report (collapsed "Posibles" opened and one severity filter deselected), light and dark, plus OS-preference and toggle/persistence tests. Scope: rule `color-contrast` only; other axe rules are not asserted (not run, none disabled silently). Run with `reducedMotion: reduce` because the landing panel fades lines (axe would sample a mid-fade colour).
  - RED (old CSS): axe reported muted text 2.71:1 and light text on a light `body` (the fixed `::before` layer is invisible to axe), and `.home-page__panel-line` 1.96 mid-fade. Real pre-existing defect found after the token fix: severity filter buttons (`.severity-toggle`) rendered badge text on the filled accent button background, 1.8:1 dark / 2.2:1 light. Fixed with a surface background.
  - GREEN: 4/4 axe tests (plus 3 theme tests) pass.
- `CI=true npm run verify`: exit 0; vitest 41 files / 224 tests; playwright 36 passed.
- Not committed (per instruction). Screenshots: `test-results/{landing,app}-{light,dark}-1440.png`.
