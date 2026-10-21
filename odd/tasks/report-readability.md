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

- [ ] RRD-01 Severity summary at the top of the report (counts per severity, zero counts hidden or dimmed).
- [ ] RRD-02 Severity filter (toggle buttons with `aria-pressed`), keeping the export button exporting the full report.
- [ ] RRD-03 Group findings by port/service, collapsible (`<details>`/disclosure pattern), first group open.
- [ ] RRD-04 Severity badge with text and an icon, not color only; consistent labels ("Crítica", "Alta", "Media", "Baja", "Desconocida").
- [ ] RRD-05 CVE ids link to `https://nvd.nist.gov/vuln/detail/<id>` (new tab, `rel="noopener noreferrer"`, accessible name).
- [ ] RRD-06 If nmap-service marks a finding as version-based ("posible"), show it distinctly with a short explanation (depends on nmap-service `vuln-severity-accuracy` VSA-02).

## Acceptance criteria

- The summary counts match the findings; filtering hides other severities; screen readers announce severity as text.

## Checks

Strict TDD (Testing Library, Playwright on the contract server), `npm run verify`.
