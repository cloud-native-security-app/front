# theme-and-contrast

- Engram topic: `odd/theme-and-contrast/tasks` (project: `front`)
- Branch: `feature/theme_and_contrast` (not created yet)
- Status: planned (2026-10-21, from the post-report UX review)
- Priority: 2

## Objective

The app honors the user's light/dark preference and every text and control meets WCAG AA contrast.

## Problem (observed)

- Only a dark theme exists; `.home-page` and `.app-shell--authenticated` duplicate the same dark palette by hand (`home.css`, `index.css`); the light `:root` palette is never visible.
- Muted text `#8996ac` on `#131b2c` is around 5:1 at 0.85rem, close to the limit; disabled buttons have low contrast (`index.css` disabled rules).

## Tasks

- [ ] TAC-01 Single source of color tokens with a dark and a light set; remove the duplicated palettes.
- [ ] TAC-02 Follow `prefers-color-scheme` by default, plus a theme toggle in the header (persisted in `localStorage`, wrapped in try/catch).
- [ ] TAC-03 Raise muted text and disabled controls to at least 4.5:1 (text) and 3:1 (UI components) in both themes; document the measured ratios.
- [ ] TAC-04 Automated contrast check in e2e (e.g. `@axe-core/playwright` on landing, Escanear, Historial, Objetivos and a report, both themes).

## Acceptance criteria

- No axe color-contrast violations in either theme; the toggle and the OS preference both work.

## Checks

Strict TDD where behavior changes (toggle, persistence), axe in Playwright, `npm run verify`.
