# layout-and-forms

- Engram topic: `odd/layout-and-forms/tasks` (project: `front`)
- Branch: `feature/layout_and_forms`
- Status: done (2026-10-20); parent re-ran `CI=true npm run verify`: exit 0
- Priority: 3

## Objective

The landing is centered and the forms are compact and proportional to the data they take.

## Problem (observed)

- Landing pushed to the left: `.home-page__shell` (`home.css:84-90`) and `.home-page__footer` (`home.css:273-278`) have `max-width` but no `margin-inline: auto`.
- Every text input is `width: 100%` of the 960 px column (`index.css:260-271`): an IP or a username field spans the whole page, so both forms look large and clumsy.
- Empty and loading states use `role="status"`, which is styled as a green success box (`index.css:398`).
- No success feedback after saving a credential; no confirmation before deleting one.

## Tasks

- [x] LAF-01 Center the landing shell and footer on wide screens; keep the mobile layout.
- [x] LAF-02 Credential form as a compact single row on desktop (IP · user · password · sudo · button), stacked on mobile; inputs sized to their content.
- [x] LAF-03 Scan form as one line (target + "Escanear"); success notice "Escaneo en cola".
- [x] LAF-04 Neutral styling for empty/loading states, distinct from success; empty states with a call to action ("Agrega tu primer objetivo").
- [x] LAF-05 Success toast/notice after saving a credential; confirm dialog before deleting ("¿Borrar la credencial de 10.0.0.5?").

## Acceptance criteria

- On a 1440 px viewport the landing content is horizontally centered.
- The credential and scan forms fit in one row at >= 960 px and stack below 640 px.
- Deleting asks for confirmation; saving shows a success notice.

## Checks

Strict TDD where behavior changes (confirm dialog, notices); Playwright visual checks at 1440 px and 390 px; `npm run verify`.

## Evidence

Route: delegated writer (single bounded writer), strict TDD.

- LAF-03/04/05 (Vitest, RED then GREEN): after writing tests only, `npx vitest run` gave 14 failed / 149 passed (notice copy, neutral tone, confirm flow, success notice, empty copy). After implementation, `npx vitest run`: 34 files, 163 tests passed.
- LAF-01/02/03 layout (Playwright `e2e/layout.spec.ts`): landing centered at 1440 (left/right gap diff <= 8 px); credential inputs share one row at 1440 (same top) and stack at 390 with no horizontal overflow; scan input and button share one line. RED for the layout specs was not captured before the CSS (CSS written in the same pass); the first runs failed on scan-button alignment (global `button { align-self: flex-start }`) and went GREEN after the fix.
- Choices: scan notice is "Escaneo en cola." without the raw UUID (e2e/unit regexes updated); neutral tone via `data-tone="neutral"`; inline confirm "¿Borrar la credencial de <IP>? Sí, borrar / Cancelar" (focus on Cancelar, Escape cancels); dismissible "Credencial guardada." notice.
- `CI=true npm run verify`: exit 0 (vitest 163/163, playwright 22/22).
- Screenshots (gitignored): `test-results/{landing-1440,landing-390,dashboard-1440,dashboard-390}.png`.
