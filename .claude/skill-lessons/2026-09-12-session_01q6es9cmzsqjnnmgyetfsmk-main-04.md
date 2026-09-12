# .claude/skills/qa-code-review/references/playwright-suite.md — a ported test's guard conditions carry the source's strength, like its assertions

- Added: 2026-09-12
- Applies to: target only
- Evidence: A bot finding on percona/pmm-qa#1417 asked for `realFailures` to be asserted independently of the no-data count, because the current gate lets an unexpected panel pass when the total is within budget. The author declined: in `codeceptjs-e2e/tests/pages/dashboardPage.js:1341-1355` the only assertion sits inside both guards, so the source fails only when both hold, and asserting `realFailures` separately would make the migrated test strictly stricter than its source and could fail nightly where the source passes (https://github.com/percona/pmm-qa/pull/1417#discussion_r3994397007). Same lesson as the ported-assertion-strength entry from #1402, on a compound guard rather than on a matcher.
- Proposed change: when the ported-assertion-strength clause is generalized, cover the guard conditions around an assertion as well as the matcher, so lifting an AND-ed guard into an independent assertion is treated as a coverage change that needs evidence.
