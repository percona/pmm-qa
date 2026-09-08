# .claude/skills/repos/SKILL.md — `cancelled` and `skipped` check runs are not green

- Added: 2026-09-08
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: A poller that classified check runs as failed / pending / else-green reported `ALL_GREEN:38` for a matrix that a push had just superseded — `cancelled` is a *completed* conclusion, so 37 cancelled jobs read as success and would have been cited as CI evidence.
- Proposed change: In the Actions section, record that a check run's `conclusion` must be partitioned explicitly — `failure`/`timed_out`/`action_required` are red, `cancelled`/`skipped`/`stale`/`neutral` prove nothing, and only `success` is green — and that a push supersedes in-flight jobs into the middle group.
