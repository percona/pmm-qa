# .claude/skills/linode-docker-provisioning/SKILL.md — a grep filter in a detached script needs --line-buffered

- Added: 2026-09-19
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md
- Evidence: A detached `npx playwright test … | grep -E '✘|✓|passed|failed'` writing to the job log showed only the phase header through nine one-minute polls while four of five tests had already finished; the lines appeared all at once when the pipeline exited.
- Proposed change: In "Anything longer than ~10 minutes runs detached", state that a filter between the command and the log file must be `grep --line-buffered` (or the log must take the raw output), or the polls read nothing until the job ends.
