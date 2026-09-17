# .claude/skills/qa-code-review/SKILL.md — check 11's codeceptjs carve-out is too broad: an assertion guaranteeing a widget quirk belongs in the page object

- Added: 2026-09-17
- Applies to: .claude/skills/qa-code-review/SKILL.md (check 11)
- Evidence: Check 11 says that in `codeceptjs-e2e/` a page method is raised "only when the method hides an assertion". Two threads on percona/pmm-qa#1444 rejected exactly that finding against `setSqlQuery` in `tests/pages/explorePage.js`: "Staying as is: the page object is where Monaco's quirk is known, so every caller gets the guarantee instead of each scenario restating it" — https://github.com/percona/pmm-qa/pull/1444#discussion_r4032395139 and https://github.com/percona/pmm-qa/pull/1444#discussion_r4032404576, where the author took the widening half of the same finding (`replace(/\s+/g, ' ')`) while keeping the assertion's location.
- Proposed change: Narrow check 11's carve-out — a hidden assertion in a `codeceptjs-e2e/` page method is a finding only where it asserts the scenario's subject; one that guarantees a widget-specific invariant to every caller (a Monaco rendering quirk) is where it belongs.
