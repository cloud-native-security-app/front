# resilient-error-handling

- Engram topic: `odd/resilient-error-handling/tasks` (project: `front`)
- Branch: `feature/resilient_error_handling` (not created yet)
- Status: planned (2026-10-20, from the UX audit after the first AWS deploy)
- Priority: 1

## Objective

A failed request or an unexpected render error must never leave the page blank or stuck; the user always sees a clear message and a way to continue.

## Problem (observed)

- There is no React error boundary: any render exception blanks the whole app.
- `src/api/httpClient.ts:156` reads `response.text()` outside the `try/catch`; a body-read failure is an unhandled rejection that leaves a credential row stuck on "Borrando…".
- Any 401/403 calls `notifyUnauthorized()` and the dashboard silently falls back to the landing page, with no explanation.
- Row errors in the credentials list persist until the same row is clicked again.

## Scope

In: error boundary, safe body reads in the HTTP client, a "session expired" notice, clearing stale row errors.
Out: copy rewrite (feature `user-facing-copy`), layout (feature `layout-and-forms`).

## Tasks

- [ ] REH-01 Error boundary around the authenticated shell and the landing page, with a friendly fallback ("Algo salió mal" + "Recargar") and the error logged to the console.
- [ ] REH-02 `performRequest`: move the body read inside the `try` and map a read failure to a typed error; no promise can reject out of the API layer.
- [ ] REH-03 Session expiry: when a 401/403 ends the session, the landing page shows "Tu sesión expiró, inicia sesión nuevamente".
- [ ] REH-04 Credentials list: a row error clears on the next successful action or after a timeout; a stuck "Borrando…" is impossible.

## Acceptance criteria

- Forcing a render exception shows the fallback, not a blank page.
- A response whose body cannot be read produces a visible error and the row returns to an actionable state.
- An expired session lands on the home page with the expiry notice.

## Checks

Strict TDD (Vitest + Testing Library for units, Playwright for the expiry flow). `npm run verify`.
