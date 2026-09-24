# .claude/skills/linode-docker-provisioning/SKILL.md — grep on a detached log with /proc environ output stops at "binary file matches"

- Added: 2026-09-24
- Applies to: target only
- Evidence: A detached Playwright run's log contained `cat /proc/<pid>/environ` output (NUL bytes), so the documented "read the log on the box with grep" printed `grep: (standard input): binary file matches` and dropped the pass/fail summary, which cost a full re-run to see the result.
- Proposed change: In "Anything longer than ~10 minutes runs detached", tell readers to grep detached logs with `grep -a` (or pipe through `tr -d '\000'`), since test logs routinely include environ/cmdline dumps.
