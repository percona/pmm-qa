# .claude/skills/linode-docker-provisioning/SKILL.md — a scratch Playwright config must override projects[].use and testDir, not just top-level use

- Added: 2026-09-07
- Applies to: target only
- Evidence: extending `e2e_tests/playwright.config.ts` with top-level `use.proxy` and `use.launchOptions` had no effect because the base config's `projects[0].use` wins, and `testDir: './tests'` resolved relative to the scratch file in /tmp, giving "No tests found" and then the missing-headless-shell error.
- Proposed change: in "Running the repo's own Playwright suite", show the scratch config mapping the overrides over `base.projects` as well as top-level `use`, and setting an absolute `testDir`.
