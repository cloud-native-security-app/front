# user-facing-copy

- Engram topic: `odd/user-facing-copy/tasks` (project: `front`)
- Branch: `feature/user_facing_copy`
- Status: implemented, uncommitted (2026-10-20); `CI=true npm run verify` exit 0
- Priority: 2

## Objective

Every title, label, status and error message speaks the user's language: no repo names, no internal components, no raw enums, and no promises the product does not keep.

## Problem (observed)

- The brand is the repo name: `<title>front — Consola de análisis</title>` (`index.html:5`), `<h1>front</h1>` (`App.tsx:75`), "front" on the landing (`HomePage.tsx:48`, lede).
- Errors mention internal parts: "No se pudo contactar al Gateway…" (ScanForm, NetworkCredentialForm, NetworkCredentialsManager, HistoryTable, ReportView, LogoutButton), and the landing footer "front habla únicamente con el Gateway de la plataforma.".
- Raw gateway bodies are interpolated ("El Gateway rechazó el objetivo: …") and unknown statuses show "error inesperado (código N)"; a 422 (no credential for the target) is not explained.
- Raw enums are shown: `PENDIENTE`, `EN_PROGRESO`, `COMPLETADO`, `FALLIDO`; SSE shows "(desconectado)" after a successful finish.
- Stale copy: "IP o rango" and the placeholder `192.168.1.0/24`, while the gateway now accepts a single IP (`/32` is normalized); the landing promises ranges and export.
- Fields without help: "Credencial SSH", "Tiene privilegios sudo"; jargon in the report ("Script NSE", "CPEs").

## Decisions to take

- D1 Product name: **Security Scan App** (user decision, 2026-10-20).

## Tasks

- [x] UFC-01 Brand: one constant for the product name; use it in `<title>`, header and landing.
- [x] UFC-02 Error messages: replace every "Gateway" mention with neutral wording ("No pudimos conectar con el servidor"); map 422 to "Primero agrega una credencial para ese objetivo"; never show raw server bodies.
- [x] UFC-03 Status labels: map enums to "En cola", "Escaneando…", "Completado", "Falló" with consistent colors; after a terminal SSE event show the final state, not "desconectado".
- [x] UFC-04 Target copy: "IP del objetivo", placeholder `192.168.1.10`, client validation accepts a single IP (and `/32`, normalized) and rejects wider ranges with the same wording as the gateway.
- [x] UFC-05 Help text: "Credencial SSH" ("contraseña SSH del usuario en el objetivo"), sudo ("permite un escaneo más profundo"), report jargon tooltips.
- [x] UFC-06 Landing copy aligned with what the product does today (single IP; export only when the report exists).

## Acceptance criteria

- `rg -n 'Gateway|EN_PROGRESO|PENDIENTE|IP o rango' src --glob '!*.test.*' --glob '!src/api/**'` finds no user-visible strings.
- The product name appears in the tab title, header and landing.

## Checks

Strict TDD (Testing Library assertions on visible text), `npm run verify`.

## Evidence

- Route: delegated writer (single bounded writer), Strict TDD; runner `vitest run` + Playwright via `npm run verify`.
- RED (all tasks, tests updated first): `npx vitest run` -> 14 files / 34 tests failed, 107 passed (141 total). Covered UFC-01 (`tests/copy.test.ts`, App/Home), UFC-02 (ScanForm 422, credential form, Logout/Manager messages), UFC-03 (`scanStatus.test.ts`, history/ScanForm status), UFC-04 (`validateScanTarget.test.ts`, labels/placeholder), UFC-05 (help text, CPE/NSE), UFC-06 (HomePage).
- GREEN: `npx vitest run` -> 34 files / 158 tests passed.
- `CI=true npm run verify` -> exit 0 (format, lint, typecheck, vitest 158/158, build, Playwright 18 passed).
- Acceptance `rg -n 'Gateway|EN_PROGRESO|PENDIENTE|IP o rango' src --glob '!*.test.*' --glob '!src/api/**'`: remaining hits are code comments and enum identifiers only (status map keys, CSS `data-status` selector, `isCancellableEntry`, `useScanEvents`); no user-visible string.
- Contract server: `203.0.113.99` now answers 422 (no credential) to cover the UFC-02 mapping in unit and e2e tests.
- Deviations: `unexpected` errors no longer expose the HTTP code in the UI (not logged to console either); credentials form hint still non-blocking and now submits the normalized IP.
- Next step: review diff, commit as work units, then `layout-and-forms`.
