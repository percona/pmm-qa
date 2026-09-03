# .claude/skills/qa-code-review/SKILL.md — a scan over candidate elements must not let one unactionable candidate end it

- Added: 2026-09-03
- Applies to: all pmm-qa Playwright test review and authoring
- Evidence: replacing a positional marker lookup with a scan placed `hover()` outside the try/catch that guarded the tooltip wait. Measured on a live PMM box, the dashboard renders 24 annotation markers because every panel draws its own per annotation, and annotations minutes apart land pixels apart, so 9 of the 24 have a neighbouring marker over their centre and Playwright refuses to hover them ("intercepts pointer events"). The first such candidate threw at the project's 10s `actionTimeout` and ended the search, failing two tests that the positional version passed.
- Proposed change: add a check that in a loop selecting among candidate elements, the interaction itself sits inside the guard with its own bounded timeout so an unactionable candidate is skipped, and that the loop has an overall budget plus a failure message naming what was searched for.
