# .claude/skills/linode-docker-provisioning/SKILL.md — Playwright empties test-results at the start of every run

- Added: 2026-09-19
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: A detached script ran three `npx playwright test` phases in sequence; the JSON evidence the second phase wrote under `test-results/` was gone when the third phase started, and it had to be re-run to fetch it.
- Proposed change: In the detached-run guidance, have a multi-phase Playwright script copy each phase's evidence out of `test-results/` (to `/root/`) before the next `npx playwright test` starts.
