# scan-report

- Engram topic: `odd/scan-report/tasks` (project: `front`)
- Branch: `feature/scan_report` (not created yet; spans `front`, `gateway`, `user-service`)
- Status: in progress; D1 = option A; SRP-01/02/03 done, SRP-04 pending deploy
- Priority: 5

## Objective

"Ver reporte" opens the real report of a completed scan (RF-11): ports, services and vulnerabilities, exportable as JSON.

## Problem (observed)

- `front` calls `GET /api/scans/{id}/report` (`src/api/report.ts:31-33`), which exists only in the local contract server; the real gateway returns 404, so the user sees "El reporte no existe o no pertenece a tu sesión.".
- The report renders at the bottom of the page, with no focus move and no way to close it.

## Decision to take

- D1 Where the report data lives:
  - Option A (recommended): the gateway already receives the full `ScanResult` in the `completed` outcome and calls user-service to update the scan status; it also sends the result, user-service stores it with the history entry, and the gateway exposes `GET /api/scans/{id}/report` reading it (ownership check reused).
  - Option B: a new `ms-analisis` service subscribed to `scan-outcomes` (fan-out, broker decision Q7) that builds and serves reports. Showcases event-driven design; more services to build, deploy and pay for.

## Tasks (option A)

- [x] SRP-01 (user-service commits 98cc00f + ca63d81) user-service: store the scan result with the history entry; endpoint to read it by scan id for the owner (Strict TDD, testcontainers Postgres).
- [x] SRP-02 (gateway commit 7d76da0) gateway: forward the `completed` result to user-service; `GET /api/scans/{id}/report` (404 not found/not owner, 409 not ready); OpenAPI docs; LocalStack e2e.
- [x] SRP-03 front (2026-10-20, branch `feature/scan_report`, uncommitted): remove the "speculative contract" warning in `src/api/report.ts`; report as a panel/page with "Volver", focus moved to its heading; export JSON.
- [ ] SRP-04 (pending deploy of user-service + gateway) Live check on AWS: completed scan -> report renders.

## Acceptance criteria

- A completed scan shows its report from the real gateway; another user's scan id returns 404; a running scan returns "todavía no terminó".

## Checks

Strict TDD in every repo; `make verify` (gateway, user-service), `npm run verify` (front); live check on the AWS stack.

## Front evidence (SRP-03)

- SRP-03a `getReport`/`isScanResult` match the gateway `ScanResult` field by field (no mismatch found); speculative warning removed; 409 -> `not_ready`, 404 -> `not_found`, 502/504 -> new `unavailable`.
- SRP-03b `ScanStatus` + `CANCELADO`, `failure_reason` in `ScanHistoryEntry`/guard (required, string|null), "Cancelado" label, `Motivo: ...` line under FALLIDO/CANCELADO rows, no "Cancelar" for CANCELADO, cancel 409 message friendly.
- SRP-03c `/historial/:scanId` shows the report in place of the table with a "Volver al historial" link; heading focus kept; severity badge (`severity-badge`, existing color tokens); states loading / not ready / not found / unavailable via `src/copy.ts`.
- SRP-03d contract server: `failure_reason`, cancel -> `CANCELADO` (409 also for CANCELADO), report 200/404/409 (plain-text body).
- RED: `npx vitest run` -> 18 failed / 184 passed (new tests before implementation).
- GREEN: `CI=true npm run verify` exit 0; vitest 39 files / 202 tests passed; playwright 29 passed.
