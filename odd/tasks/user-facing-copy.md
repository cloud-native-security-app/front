# user-facing-copy

- Engram topic: `odd/user-facing-copy/tasks` (project: `front`)
- Branch: `feature/user_facing_copy` (not created yet)
- Status: planned (2026-10-20, from the UX audit)
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

- D1 Product name (proposals: "Vigía", "Sentinel", "Escáner de vulnerabilidades"). Needs the user's choice before RF-01.

## Tasks

- [ ] UFC-01 Brand: one constant for the product name; use it in `<title>`, header and landing.
- [ ] UFC-02 Error messages: replace every "Gateway" mention with neutral wording ("No pudimos conectar con el servidor"); map 422 to "Primero agrega una credencial para ese objetivo"; never show raw server bodies.
- [ ] UFC-03 Status labels: map enums to "En cola", "Escaneando…", "Completado", "Falló" with consistent colors; after a terminal SSE event show the final state, not "desconectado".
- [ ] UFC-04 Target copy: "IP del objetivo", placeholder `192.168.1.10`, client validation accepts a single IP (and `/32`, normalized) and rejects wider ranges with the same wording as the gateway.
- [ ] UFC-05 Help text: "Credencial SSH" ("contraseña SSH del usuario en el objetivo"), sudo ("permite un escaneo más profundo"), report jargon tooltips.
- [ ] UFC-06 Landing copy aligned with what the product does today (single IP; export only when the report exists).

## Acceptance criteria

- `rg -n 'Gateway|EN_PROGRESO|PENDIENTE|IP o rango' src --glob '!*.test.*' --glob '!src/api/**'` finds no user-visible strings.
- The product name appears in the tab title, header and landing.

## Checks

Strict TDD (Testing Library assertions on visible text), `npm run verify`.
