# sectioned-navigation

- Engram topic: `odd/sectioned-navigation/tasks` (project: `front`)
- Branch: `feature/sectioned_navigation` (off origin/develop)
- Status: done (2026-10-20), parent re-ran `CI=true npm run verify`: exit 0; SNV-03 failure reason / "Cancelado" blocked on cross-repo follow-ups
- Priority: 4

## Objective

Split the single long page into clear sections and remove duplicate typing: the scan form picks from the user's saved targets.

## Problem (observed)

- `App.tsx:65-86` renders everything in one scroll: credentials, scan form, history and report; there is no router (`src/routes/index.ts` is empty) and no nav.
- No user identity in the header (only "Cerrar sesión").
- The target IP is typed twice: once in the credential and again in the scan form.
- Live status (SSE) only covers the scan submitted in this session; history rows update via a 7 s poll and are not refreshed when a scan finishes.
- Failed scans show no reason; cancelled scans have no visible state.

## Tasks

- [x] SNV-01 Client-side routing with three sections: "Escanear", "Historial", "Objetivos" (credentials); header with product name, user name/e-mail and "Cerrar sesión".
- [x] SNV-02 Scan form: a dropdown of saved targets (from the credentials list) instead of free text; a link to add a target when there is none.
- [x] SNV-03 (immediate refresh only; failure reason and "Cancelado" deferred, see follow-ups) History: refresh when a live scan reaches a terminal state; show the failure reason for failed scans; show "Cancelado" when applicable (check what the gateway/user-service history returns).
- [x] SNV-04 Focus management: move focus to the new section heading on navigation and to the next row after a delete.

## Dependencies

- The user name/e-mail comes from `GET /api/me` (already used by the session provider).
- SNV-03 failure reason / cancelled state may need the gateway history entry to expose them (cross-repo; confirm before starting).

## Acceptance criteria

- Each section is reachable from the nav and by URL; browser back/forward works.
- Scanning a saved target needs no typing.
- A finished scan updates the history row without waiting for the poll.

## Checks

Strict TDD (Testing Library + Playwright e2e for navigation and the scan flow), `npm run verify`.

## Evidence

- Route: delegated writer (one writer; Strict TDD; runner `vitest run` + `playwright test`, via `npm run verify`).
- Router decision: `react-router-dom` 7.18.4, exact pin in `dependencies` (peer `react >=18`, no Node 22 requirement). Latest `react-router` is 8.5.0 (engines `node >=22.22`, newer than the project's Docker/CI baseline was verified for), so the mature 7.x line was chosen. A dependency-free approach was rejected: three sections plus `/historial/:scanId`, `aria-current`, back/forward and redirects would mean re-implementing history handling. `App` creates no router: `main.tsx` uses `BrowserRouter`, tests use `MemoryRouter`. `nginx.conf.template` already has `try_files $uri /index.html`; `vite preview` serves the SPA fallback (deep-link e2e passes).
- Design: report is a sub-route `/historial/:scanId` (linkable, reloadable, back/forward) rendered below the history table. Live scan state moved into `ScanActivityProvider` (shell level) so the SSE subscription survives navigation; `HistoryTable` refetches when `finishedScanId` appears.
- RED (before implementation): `vitest run` -> 7 files failed, 28 tests failed, 154 passed (new/rewritten: `tests/routes/navigation.test.tsx`, `ScanForm.test.tsx`, `HistoryTableRefresh.test.tsx`, `NetworkCredentialsFocus.test.tsx`, `ReportDetails` focus, `App.test.tsx`, empty-history copy). Playwright specs were written first as well (`e2e/sectioned-navigation.spec.ts`, updated existing specs).
- GREEN: `npx vitest run` -> 37 files, 182 tests passed. First `CI=true npm run verify` had 1 e2e failure (strict-mode locator in my new spec: two "Objetivos" links); fixed by scoping to the nav.
- Final: `CI=true npm run verify` -> exit 0; vitest 37 files / 182 tests; playwright 29 passed.
- SNV-01: header (brand, nav with `aria-current`, user name/e-mail from `/api/me`, compact "Cerrar sesión"), `/`, unknown paths -> `/escanear`; anonymous users see the landing on any path.
- SNV-02: `<select>` of saved targets (deduplicated `target_pattern`), placeholder, empty state "Agrega un objetivo para poder escanear." + link "Objetivos"; validation/normalization unchanged (e.g. `10.9.9.9/32` -> `10.9.9.9`, ranges rejected).
- SNV-03: history refetches immediately on terminal live status (unit test without waiting for the 7 s poll).
- SNV-04: focus to section h2 (`tabindex=-1`) on section change, to the next row's "Borrar" (previous if last, empty message if none) after delete, to the report heading when it opens.
- Screenshots (gitignored): `test-results/escanear-1440.png`, `historial-1440.png`, `objetivos-1440.png`, `dashboard-390.png`.

## Cross-repo follow-ups

- Failure reason: `ScanHistoryEntry` (`GET /api/scans`) has no reason field; the reason only travels in the SSE `failed` event. Not shown to avoid inventing it. Needs gateway/user-service to persist and expose it (e.g. `failure_reason`) in the history entry; then show it in `HistoryTableView`.
- "Cancelado" state: `ScanStatus` is `PENDIENTE | EN_PROGRESO | COMPLETADO | FALLIDO`; the contract server maps cancel to `FALLIDO`. Needs the gateway/user-service to return a distinct cancelled status; then add it to `ScanStatus`, `SCAN_STATUS_LABEL` and the guards.
