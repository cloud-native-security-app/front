# vuln-confidence (front)

- Branch: `feature/vuln_confidence` (2026-10-21)
- Cross-repo: gateway and nmap-service `feature/vuln_confidence` (same contract). Deploy order: gateway -> nmap-service -> front.
- Implements RRD-06 of `report-readability` early; when that plan lands in develop, tick RRD-06 there.

## Contract

Each `ScanResult.vulnerabilities[]` item may carry an optional `confidence`: `"confirmed"` | `"version_match"`; absent or unknown = no badge.

## Change

- `src/api/types.ts`: `VulnerabilityConfidence`; `ScanVulnerability.confidence?` (any string tolerated). The guard already ignores extra fields.
- `src/copy.ts`: "Confirmada", "Posible (según versión)" and the backport explanation.
- `src/features/report/ReportDetails.tsx`: confidence badge after the severity badge; one explanatory note above the list when any finding is `version_match`.
- `e2e/contract-server/store.ts`: sample report with 1 confirmed and 2 version_match findings.

## Evidence

- Route: delegated writer, strict TDD.
- RED: the ReportDetails badge/note test failed ("Confirmada" not found). Guard tests passed before the change (regression guards: the guard already tolerated extra fields).
- GREEN: `CI=true npm run verify` exit 0; vitest 39 files / 207 tests; playwright 29 passed.
