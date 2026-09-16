# .claude/skills/qa-code-review/references/playwright-suite.md — a live "resolves to 1" count is no evidence of locator uniqueness until every Grafana panel is rendered

- Added: 2026-09-16
- Applies to: .claude/skills/qa-code-review/references/playwright-suite.md
- Evidence: Measured on a live PMM Server and reported at https://github.com/percona/pmm-qa/pull/1437#discussion_r4025947628 — the dashboard has 89 grid items and zero collapsed rows, a default load renders 19 `section[data-testid]` panels, and after `loadAllPanels()` 81 render and four asserted titles resolve to 2 each; a correct duplicate-locator finding was refuted twice on the 19-panel count and withdrawn before being reinstated.
- Proposed change: Under Locators, require any count offered as proof that a Grafana panel locator is unique to be measured after `loadAllPanels()`, and state that a green strict-mode test on a default viewport proves nothing about uniqueness.
