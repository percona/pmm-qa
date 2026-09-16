# .claude/skills/qa-code-review/references/playwright-suite.md — a dashboard test owns no panel list and no raw Playwright call

- Added: 2026-09-16
- Applies to: .claude/skills/qa-code-review/references/playwright-suite.md
- Evidence: A maintainer asked for a page object per dashboard with the panel data moved out of the test, citing `pages/dashboards/valkey/*.ts` (https://github.com/percona/pmm-qa/pull/1437#discussion_r4024909918), repeated it for raw Playwright methods in the test file (https://github.com/percona/pmm-qa/pull/1437#discussion_r4026236320), and later rejected a locator fix that changed the agreed panel contract (https://github.com/percona/pmm-qa/pull/1437#discussion_r4026229989).
- Proposed change: Add to Page objects that a dashboard page object implements `DashboardInterface` and owns its `GrafanaPanel[]`, so a panel array declared in a test or a locator fix that reshapes that contract is a finding.
