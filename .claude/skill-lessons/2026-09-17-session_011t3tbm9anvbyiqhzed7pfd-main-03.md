# .claude/skills/qa-code-review/references/playwright-suite.md — "Loop over tests, not inside one" is wrong when each generated test re-navigates to the same page

- Added: 2026-09-17
- Applies to: .claude/skills/qa-code-review/references/playwright-suite.md (Structure)
- Evidence: A maintainer opened a thread on percona/pmm-qa#1443 against a `for` loop generating one test per case in `e2e_tests/tests/dashboards/searchDashboards.test.ts`: "Can't the for loop live under a single test that checks all expands? Don't see the reason to close and reopen the same page multiple times to perform a check that lives here." The PR author agreed. https://github.com/percona/pmm-qa/pull/1443#discussion_r4039895371
- Proposed change: Qualify the Structure rule so it governs independent cases only — where each generated test reloads the same page to assert one thing, the per-test isolation buys nothing and the reloads dominate the runtime, so one test iterating in the body is right. Second independent maintainer verdict against this rule this week; see the queued entry proposing the same qualification from a different PR.
