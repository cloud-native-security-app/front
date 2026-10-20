# resilient-error-handling

- Engram topic: `odd/resilient-error-handling/tasks` (project: `front`)
- Branch: `feature/resilient_error_handling` (created off origin/develop)
- Status: done (2026-10-20); `CI=true npm run verify` re-run by the parent: exit 0, vitest 144 passed, Playwright 16 passed
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

- [x] REH-01 Error boundary around the authenticated shell and the landing page, with a friendly fallback ("Algo salió mal" + "Recargar") and the error logged to the console.
- [x] REH-02 `performRequest`: move the body read inside the `try` and map a read failure to a typed error; no promise can reject out of the API layer.
- [x] REH-03 Session expiry: when a 401/403 ends the session, the landing page shows "Tu sesión expiró, inicia sesión nuevamente".
- [x] REH-04 Credentials list: a row error clears on the next successful action or after a timeout; a stuck "Borrando…" is impossible.

## Acceptance criteria

- Forcing a render exception shows the fallback, not a blank page.
- A response whose body cannot be read produces a visible error and the row returns to an actionable state.
- An expired session lands on the home page with the expiry notice.

## Checks

Strict TDD (Vitest + Testing Library for units, Playwright for the expiry flow). `npm run verify`.

## Evidence

Route: delegated writer (single bounded writer), strict TDD.

- REH-01 RED: `npx vitest run` -> `tests/components/ErrorBoundary.test.tsx` (3) and `tests/App.test.tsx` boundary test failed (module `src/components` had no `ErrorBoundary`). GREEN: same command, 32 files / 144 tests passed.
- REH-02 RED: `npx vitest run tests/api/httpClient.test.ts` -> "promise rejected TypeError: body stream interrumpido instead of resolving" (1 failed, 3 passed). GREEN: now resolves `{ networkError: true }`.
- REH-03 RED: `tests/auth/SessionExpiredNotice.test.tsx` (4 failed, no `SessionExpiredNotice`/`expired`). GREEN: passing; Playwright `e2e/session-expiry.spec.ts` (2 tests) passing. The e2e uncovered that the full-bleed `.home-page` covered the notice; fixed with a pinned `.session-expired-notice` in `src/index.css`.
- REH-04 RED: 2 new tests in `NetworkCredentialsManager.test.tsx` failed (unhandled body rejection / stale error kept). GREEN: passing.
- Full first RED run: `npx vitest run` -> 10 failed | 134 passed (plus the httpClient test = 11 RED). Final: `CI=true npm run verify` -> prettier ok, eslint ok, tsc ok, vitest 32 files / 144 tests passed, build ok, Playwright 16 passed.

Design notes:
- A body-read failure maps to `{ networkError: true }` (typed `network` error) instead of a new kind: no response usable was obtained, existing UI copy applies.
- `SessionState.expired?: boolean` (optional, backwards compatible); `SessionProvider` sets it only when a 401/403 arrives while `authenticated`. `SessionExpiredNotice` (src/auth) is dismissible via local state and sits in `anonymousView` in `App.tsx`.
- A single `ErrorBoundary` (src/components) wraps `ProtectedRoute`, so it covers both the authenticated shell and the landing page.
- Row errors clear on any successful delete or successful refresh (rows still "deleting" are preserved); `handleDelete` has a catch fallback so a row cannot stay on "Borrando…". Timeout auto-clear not implemented (optional, kept simple).

## Next step

Review and commit by work unit; copy rewrite continues in `user-facing-copy`.
