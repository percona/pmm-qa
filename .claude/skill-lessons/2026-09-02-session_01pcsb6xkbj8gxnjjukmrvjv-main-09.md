# .claude/agents/investigator.md — read a failing step from the run-logs zip, not a get_job_logs tail

- Added: 2026-09-02
- Applies to: .claude/agents/investigator.md and .claude/skills/fb-tests/SKILL.md
- Evidence: Diagnosing a red `Run Setup for E2E Tests` step, two `get_job_logs` calls with `tail_lines` 70 then 125 returned only the post-step noise (log upload, git credential cleanup) and never reached the error, costing roughly 12k tokens; `actions_get` `get_workflow_run_logs_url` had 404'd because the run was still in progress. After the run completed, that zip unpacked to one file per step per job (`14_Run Setup for E2E Tests.txt` under the job's directory), and a single grep produced the exact cause — a dnf mirror rejecting a package whose repodata length disagreed with the served file.
- Proposed change: Say that the failing step's own output comes from the run-logs zip (`get_workflow_run_logs_url`, which 404s until the run completes, then `<step number>_<step name>.txt` inside the job's directory) and to grep that file, rather than growing `tail_lines` on `get_job_logs` — a tail window reaches the trailing steps, not the failing one.
