# sectioned-navigation

- Engram topic: `odd/sectioned-navigation/tasks` (project: `front`)
- Branch: `feature/sectioned_navigation` (not created yet)
- Status: planned (2026-10-20, from the UX audit)
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

- [ ] SNV-01 Client-side routing with three sections: "Escanear", "Historial", "Objetivos" (credentials); header with product name, user name/e-mail and "Cerrar sesión".
- [ ] SNV-02 Scan form: a dropdown of saved targets (from the credentials list) instead of free text; a link to add a target when there is none.
- [ ] SNV-03 History: refresh when a live scan reaches a terminal state; show the failure reason for failed scans; show "Cancelado" when applicable (check what the gateway/user-service history returns).
- [ ] SNV-04 Focus management: move focus to the new section heading on navigation and to the next row after a delete.

## Dependencies

- The user name/e-mail comes from `GET /api/me` (already used by the session provider).
- SNV-03 failure reason / cancelled state may need the gateway history entry to expose them (cross-repo; confirm before starting).

## Acceptance criteria

- Each section is reachable from the nav and by URL; browser back/forward works.
- Scanning a saved target needs no typing.
- A finished scan updates the history row without waiting for the poll.

## Checks

Strict TDD (Testing Library + Playwright e2e for navigation and the scan flow), `npm run verify`.
