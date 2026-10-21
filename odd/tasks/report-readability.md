# report-readability

- Engram topic: `odd/report-readability/tasks` (project: `front`)
- Branch: `feature/report_readability` (not created yet)
- Status: planned (2026-10-21, from the post-report UX review)
- Priority: 1 (of the second UX round)

## Objective

A report with dozens of findings is quick to read: totals first, findings grouped and filterable, severity understandable without relying on color.

## Problem (observed)

- A live scan of a single SSH port listed 32 findings as one flat list of identical cards.
- Severity is shown only as a colored badge; there is no summary of how many findings of each severity there are.
- CVE ids are plain text with no link to their public record.

## Tasks

- [x] RRD-01 Severity summary at the top of the report (counts per severity, zero counts hidden or dimmed).
- [x] RRD-02 Severity filter (toggle buttons with `aria-pressed`), keeping the export button exporting the full report.
- [x] RRD-03 Group findings by confidence first (Confirmadas / Posibles según versión), "Posibles" in a collapsible `<details>`, collapsed by default when more than 8.
- [x] RRD-04 Severity badge with text and an icon, not color only; consistent labels ("Crítica", "Alta", "Media", "Baja", "Desconocida").
- [x] RRD-05 CVE ids link to `https://nvd.nist.gov/vuln/detail/<id>` (new tab, `rel="noopener noreferrer"`, accessible name).
- [x] RRD-06 (done in feature/vuln_confidence, merged) If nmap-service marks a finding as version-based ("posible"), show it distinctly with a short explanation (depends on nmap-service `vuln-severity-accuracy` VSA-02).

## Acceptance criteria

- The summary counts match the findings; filtering hides other severities; screen readers announce severity as text.

## Checks

Strict TDD (Testing Library, Playwright on the contract server), `npm run verify`.

## Evidence

- Route: direct inline (single writer), Strict TDD. Branch `feature/report_readability`; not committed.
- RED: `tests/features/report/ReportReadability.test.tsx` first run, 10 failed / 2 passed (the 2 passing were the no-empty-Posibles and non-CVE-plain-text guards).
- GREEN: same file 12/12; full `CI=true npm run verify` exit 0 (vitest 219/219, 40 files; playwright 29/29).
- Decisions: severity summary and filter are one control (toggle buttons `aria-pressed`, label `Alta: 2`, zero counts hidden, off state dimmed + strikethrough). Findings group by confidence (non-`version_match` goes to "Confirmadas"; missing/unknown confidence counts there) then severity order critical..unknown. Grouping by port was dropped (the finding model has no port). Threshold: `<details>` collapsed when total posibles > 8 (uses unfiltered total so it does not flip while filtering). Export untouched: `ReportView` exports `state.report` (full), covered by a test. Badge icons are decorative glyphs (`aria-hidden`) next to the label. CVE ids link to NVD with `aria-label` "Ver <id> en NVD".
- Contract server sample report now has 11 findings (1 confirmed, 10 posibles; critical/high/medium/low/unknown). e2e covers collapsed posibles with count, expand, filter toggle, CVE link; screenshot in `test-results/report-readability-1440.png` (default viewport).
