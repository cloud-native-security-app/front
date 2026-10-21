# mobile-report

- Engram topic: `odd/mobile-report/tasks` (project: `front`)
- Branch: `feature/mobile_report` (not created yet)
- Status: planned (2026-10-21, from the post-report UX review)
- Priority: 4

## Objective

On a phone, the report, history and objectives are readable without horizontal scrolling.

## Problem (observed)

- Below 640 px tables become `display: block; overflow-x: auto` (`index.css` small-screen rule): the ports table and history scroll sideways.

## Tasks

- [ ] MRP-01 Ports table renders as cards below 640 px (port/protocol as title, service/version/CPE as labeled rows).
- [ ] MRP-02 History and objectives tables render as cards below 640 px, keeping the row actions reachable.
- [ ] MRP-03 Playwright checks at 390 px: no horizontal overflow on Escanear, Historial, Objetivos and a report.

## Acceptance criteria

- At 390 px no section overflows horizontally and every action is reachable.

## Checks

Playwright viewport tests, `npm run verify`.
