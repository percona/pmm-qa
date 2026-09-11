# .claude/skills/fb-tests/SKILL.md — runner_name is a per-job ephemeral id, not a runner identity

- Added: 2026-09-11
- Applies to: .claude/skills/fb-tests/SKILL.md ("Reading history in bulk")
- Evidence: Across 850 analyzable pmm-qa jobs, `runner_name` held 850 distinct values ("GitHub Actions <n>"), so a "does the same runner recur among the slow jobs" grouping returned 17 distinct runners for 17 slow jobs and could not be answered by name at all.
- Proposed change: Note that for GitHub-hosted runners `runner_name` is unique per job, so correlate slowness by `labels`/`runner_group_name`, by run and concurrency, or by wall-clock time of day instead of by runner name.
