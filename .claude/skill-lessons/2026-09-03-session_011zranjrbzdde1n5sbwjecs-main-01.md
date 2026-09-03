# .claude/skills/qa-code-review/SKILL.md — whole-string equality against UI text needs evidence the string was measured

- Added: 2026-09-03
- Applies to: all pmm-qa Playwright test review and authoring
- Evidence: a migrated dashboard test identified Grafana annotations with `text.trim() === annotationTitle`, reasoned from the title alone and defended in a review reply. Measured on a live PMM box, an API-created annotation's tooltip reads `annotation-for-mysql (Service Name: <svc>. Node Name: <node>)` while a CLI-created one is the bare title, so the comparison could never match the API form: the two CLI-created cases passed and all five API-created cases failed. The source it was ported from used a substring `contains()` and did not have this defect.
- Proposed change: add a check that an assertion comparing UI text with whole-string equality (`=== `, `toHaveText`) must cite where the exact string was observed, and prefer a boundary match when the text may carry a suffix; treat tightening a ported substring match into equality as a coverage change needing evidence.
