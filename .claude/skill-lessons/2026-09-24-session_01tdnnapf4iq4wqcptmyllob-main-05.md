# candidate: steward — pmm-qa authors want correct optional review-bot nits applied, not deferred

- Added: 2026-09-24
- Applies to: pmm-qa PRs opened by agents (candidate `.claude/skills/steward/SKILL.md`)
- Evidence: On an agent-opened pmm-qa PR, two correct 🟡 claude-review nits (move a helper into `cli/helpers/pmm-admin.ts`, trim a narrating comment) were answered "rides the next code push if one comes" and resolved, following the harness default that optional findings never start a push. The PR's author then replied "just listen to the bot and do it", and the nits were pushed.
- Proposed change: Add a repo `steward` skill that the harness reads on agent-owned PRs, with the line "apply correct optional (🟡) claude-review findings in the same round instead of deferring them". The harness lets a repo skill override its optional-findings default.
