# .claude/skills/qa-code-review/references/playwright-suite.md — "Loop over tests, not inside one" is wrong for N checks on one already-loaded page

- Added: 2026-09-16
- Applies to: .claude/skills/qa-code-review/references/playwright-suite.md
- Evidence: A maintainer rejected splitting a seven-panel dashboard check into seven tests — "there is no need to start a new page, navigation, fixtures, for repeating tests on same page" (https://github.com/percona/pmm-qa/pull/1437#discussion_r4027101565), after the author had already declined the same review ask on scenario-count fidelity (https://github.com/percona/pmm-qa/pull/1437#discussion_r4020785539).
- Proposed change: Qualify the Structure rule so it governs independent cases and `Data(...)` rows only — N checks against one already-loaded page stay in a single test, and the remedy for "which iteration failed" is an assertion message naming the element, not a test per element.
