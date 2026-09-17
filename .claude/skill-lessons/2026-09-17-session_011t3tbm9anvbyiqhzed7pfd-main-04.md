# .claude/skills/qa-code-review/references/playwright-suite.md — `playwright/expect-expect` does not fire while the test body has its own assertions

- Added: 2026-09-17
- Applies to: .claude/skills/qa-code-review/references/playwright-suite.md (Assertions)
- Evidence: A review thread on percona/pmm-qa#1445 raised an assertion inside a page method by citing the `verify…` / `assertFunctionNames` requirement, which reads as a lint break. The author confirmed the convention and corrected the ground: "lint is currently clean, since the test has its own `expect` calls in the same body — so this is a structure finding, not a `playwright/expect-expect` break." https://github.com/percona/pmm-qa/pull/1445#discussion_r4036472788
- Proposed change: Note on the Assertions row that `playwright/expect-expect` only fires when a test body contains no recognised assertion at all, so an assertion hidden in a page method alongside test-body expects is raised as a structure finding and never as a lint failure CI is not reporting.
