# .claude/skills/repos/SKILL.md — enumerate failed jobs with a 3-line tail, read them from the zip

- Added: 2026-09-08
- Applies to: .claude/skills/repos/SKILL.md
- Evidence: `get_job_logs` with `failed_only: true`, `return_content: true`, `tail_lines: 3` returned each failed job's name for a few hundred tokens per run, which was enough to see that three consecutive nightly failures tripped on a different setup shard each time; `actions_get get_workflow_job` on the single id then gave step-level conclusions.
- Proposed change: In the tool-map/listing-economics section, record that a 3-line `failed_only` tail is the cheap way to enumerate *which* jobs failed across several runs, distinct from the existing rule that reading a failing step's output comes from the run-logs zip rather than a larger tail.
