# mobile-report

- Engram topic: `odd/mobile-report/tasks` (project: `front`)
- Branch: `feature/mobile_report` (off origin/develop)
- Status: implemented, uncommitted (2026-10-21)
- Priority: 4

## Objective

On a phone, the report, history and objectives are readable without horizontal scrolling.

## Problem (observed)

- Below 640 px tables become `display: block; overflow-x: auto` (`index.css` small-screen rule): the ports table and history scroll sideways.

## Tasks

- [x] MRP-01 Ports table renders as cards below 640 px (port/protocol as title, service/version/CPE as labeled rows).
- [x] MRP-02 History and objectives tables render as cards below 640 px, keeping the row actions reachable.
- [x] MRP-03 Playwright checks at 390 px: no horizontal overflow on Escanear, Historial, Objetivos and a report.

## Acceptance criteria

- At 390 px no section overflows horizontally and every action is reachable.

## Checks

Playwright viewport tests, `npm run verify`.

## Evidence

- Route: direct writer (single delegated worker), strict TDD, runner `playwright` (`e2e/mobile-report.spec.ts`).
- RED: at 390 px the new spec failed on `scrollableTables == 0` (history/objectives table had `overflow-x:auto` with scrollWidth > clientWidth).
- GREEN: same spec passes; page `scrollWidth - innerWidth <= 0` and no scrollable table on Objetivos, Escanear, Historial and an open report.
- CSS approach: tables kept; `data-label="<column>"` on each `td` (ports, history, credentials). In `@media (max-width: 639px)` thead is visually hidden, `tr` is a bordered flex card using existing tokens, `td::before { content: attr(data-label) }` is the label. Port/protocol render as the card title ("22/tcp"). The old `display:block; overflow-x:auto` table rule was removed; desktop (>=640px) is unchanged.
- Actions: the Acción cell (`.cell--actions`) is a full-width column of buttons with min-height 2.75rem; the spec clicks "Borrar credencial" (confirmation opens) and opens a report via "Ver reporte" at 390 px.
- Deviation: none. Screenshot: `test-results/report-390.png`.
