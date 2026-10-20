# layout-and-forms

- Engram topic: `odd/layout-and-forms/tasks` (project: `front`)
- Branch: `feature/layout_and_forms` (not created yet)
- Status: planned (2026-10-20, from the UX audit)
- Priority: 3

## Objective

The landing is centered and the forms are compact and proportional to the data they take.

## Problem (observed)

- Landing pushed to the left: `.home-page__shell` (`home.css:84-90`) and `.home-page__footer` (`home.css:273-278`) have `max-width` but no `margin-inline: auto`.
- Every text input is `width: 100%` of the 960 px column (`index.css:260-271`): an IP or a username field spans the whole page, so both forms look large and clumsy.
- Empty and loading states use `role="status"`, which is styled as a green success box (`index.css:398`).
- No success feedback after saving a credential; no confirmation before deleting one.

## Tasks

- [ ] LAF-01 Center the landing shell and footer on wide screens; keep the mobile layout.
- [ ] LAF-02 Credential form as a compact single row on desktop (IP · user · password · sudo · button), stacked on mobile; inputs sized to their content.
- [ ] LAF-03 Scan form as one line (target + "Escanear"); success notice "Escaneo en cola".
- [ ] LAF-04 Neutral styling for empty/loading states, distinct from success; empty states with a call to action ("Agrega tu primer objetivo").
- [ ] LAF-05 Success toast/notice after saving a credential; confirm dialog before deleting ("¿Borrar la credencial de 10.0.0.5?").

## Acceptance criteria

- On a 1440 px viewport the landing content is horizontally centered.
- The credential and scan forms fit in one row at >= 960 px and stack below 640 px.
- Deleting asks for confirmation; saving shows a success notice.

## Checks

Strict TDD where behavior changes (confirm dialog, notices); Playwright visual checks at 1440 px and 390 px; `npm run verify`.
