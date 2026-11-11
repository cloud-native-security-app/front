# admin-panel (KAP-10)

- Engram topic: `odd/admin-panel/tasks` (project: `front`)
- Branch: `feature/admin_panel` (from `origin/develop` 4bc8674)
- Master plan: repo `infra`, `odd/tasks/kinesis-admin-panel.md` (task KAP-10). Backend contract: repo `gateway`, `odd/tasks/admin-realtime-feed.md` (KAP-09), role in `/api/me`: `odd/tasks/admin-role-guard.md` (KAP-05), optional finding `port`/`protocol`: `odd/tasks/finding-port.md`.

## Objective

An admin-only real-time panel at `/admin`, fed by `GET /api/admin/metrics` (JSON snapshot) and the SSE `GET /api/admin/events` (events `snapshot`, `delta`, `closed`).

## Scope

- `role` in the session model (`GET /api/me`); `/admin` guarded by role; nav link only for admins.
- `src/api/admin.ts`: `getAdminMetrics()` and `subscribeToAdminEvents()` (the only place that knows these URLs), wire types and guards.
- `src/features/admin/`: reducer, data hook (container), presentational components (KPI tiles, scans in flight, critical findings feed, event log with type filter).
- Contract-server mock (`/api/me` role, metrics, SSE) and Playwright `e2e/admin-panel.spec.ts`.
- Out of scope: any change to other repos, admin user management, persistence of the panel state, a chart or history beyond the 15-minute window.

## Constraints

- The server stays the authority: the role in `/api/me` only shows or hides UI. Handle 401 (session gone: existing login flow), 403 (no longer admin: leave the panel with a message), 503 (role not verifiable: retry with backoff) from both endpoints.
- Never render more than the API sends; no PII. `actor_sub` (pseudonymous subject) of the raw log is not rendered.
- `EventSource` does not expose the HTTP status, so the REST snapshot is the probe: after any stream error or `closed` event the hook calls `GET /api/admin/metrics` first, and its status code decides (stop, back off, or reconnect).
- UI copy in neutral Spanish in `src/copy.ts`; comments and identifiers in English.
- CSP (`nginx.conf.template`) already allows `connect-src` to the gateway origin, which covers `EventSource`; no change needed.

## Decisions

- D1 Unknown or missing `role` is treated as non-admin (fail closed). `isMeResponse` still accepts a profile without `role` (older gateway) and normalizes it to `user`.
- D2 The admin 403 does not call `notifyUnauthorized()`: the user is still logged in, so the session is kept and only the panel is left. 401 does call it (existing "session expired" flow).
- D3 Reducer: `snapshot` replaces everything; `delta` merges (KPIs replaced, event and critical finding prepended with the gateway caps of 100 and 50, scan change upserts or removes, in-flight capped at 1000). A delta with `seq` not newer than the state, or arriving before any snapshot, is ignored.
- D4 Reconnect: backoff 1 s doubling to 30 s, reset when a stream `snapshot` arrives. A reconnect always yields a fresh snapshot (the gateway sends one first). Stale data stays visible with a "reconnecting" notice.
- D5 Live region for critical findings is `role="status"` (polite) and announces a single summary line ("Nuevo hallazgo crítico: ...") for the newest finding, not the whole list.

## Tooling

- TDD mode: on (source: user global config "Strict TDD Mode: enabled"); runner `npm run verify`; `npx vitest run` while iterating.
- Route: delegated direct, single writer. Review: per stored user policy, reviews declined except per-task TF-10, TF-14, TF-16 (not applicable here).

## Checklist

| ID | Task | Done |
|---|---|---|
| AP-01 | Feature document | [x] 4ba24c7 |
| AP-02 | `role` in session/me (`parseRole`), `AdminRoute` guard, nav link for admins | [x] e9d98ad |
| AP-03 | API layer, reducer and data hook (fake `EventSource`); the contract-server admin feed was added here because the API tests need it | [x] 90f1801 |
| AP-04 | Presentational components, copy, styles | [x] 04dcc29 |
| AP-05 | Route wiring, Playwright `admin-panel.spec.ts` (mock endpoints in AP-03) | [x] 4b5b20b |
| AP-06 | Docs (README, architecture, security-scope, verification, decisions D-15) and close-out | [x] docs commit on top of 4b5b20b |

## Evidence

- Route: delegated direct, single writer; no sub-agents.
- RED AP-02: `vitest run` on guards/auth/routes -> 4 files failed, 7 tests failed (`parseRole`, `role` in `getMe`, `AdminRoute` missing, no admin link). GREEN: 46 files, 264 tests.
- RED AP-03: `vitest run tests/features/admin tests/api/admin.test.ts` -> 3 files failed to load (modules missing). GREEN: 24 tests (reducer 9, hook 9 with fake `EventSource`/`fetch`/timers, API and guards 6). Full suite 49 files, 288 tests.
- RED AP-04: 15 tests failed (`AdminPanelView`/`AdminPanel` not exported). GREEN: 33 admin tests; full suite 51 files, 303 tests.
- AP-05: spec written first. Runs surfaced two real defects, fixed before the commit: the heading lost focus when the data arrived (the container now owns the section and heading), and the fourth nav link overflowed at 390 px (`.app-header__nav` now wraps). Final: `admin-panel.spec.ts` 6 passed (live updates, non-admin redirect, 403 mid-session, 503 then fresh snapshot, axe `color-contrast` and no horizontal scroll at 390 px in light and dark).
- Final: `CI=true npm run verify` exit 0 (prettier, eslint, tsc, vitest 51 files / 303 tests, build, playwright 45 passed).
- Conservative choices: unknown role is `user`; 403 does not end the session; `actor_sub` is not rendered; the event payload is shown as sent inside a collapsed `<details>`; only the newest finding is announced in the live region.

## Known gaps

- The nav link stays visible after a mid-session role loss until the page is reloaded (the session role is a snapshot); the panel itself is blocked at once.
- The delta carries no `since` for a scan: a scan first seen in a delta uses the event time, so it can differ slightly from the Gateway's own tracking time until the next snapshot.
- The real Gateway was not run against this panel (KAP-11 covers the compose end-to-end check); the contract server mirrors `gateway/odd/tasks/admin-realtime-feed.md`.

## Next step

KAP-11 (infra): end-to-end check with compose, deploy and verify in Learner Lab, cut `v3`.
