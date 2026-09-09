# .claude/agents/investigator.md — a skipped-tail setup step is reachable by `tail_lines`, no run-logs zip needed

- Added: 2026-09-09
- Applies to: .claude/agents/investigator.md
- Evidence: A nightly failure landed on setup step 6 of 20 ("Setup npm modules for e2e tests"), the case the file routes to the run-logs zip. `list_workflow_jobs` showed every step after it was `skipped`, so one `get_job_logs` call on that `job_id` with `tail_lines: 220` returned the failing step's own output (the apt error and its exit code) directly; the zip was never fetched.
- Proposed change: Qualify the "a tail window reaches the trailing steps, not the failing one" rule — it holds when substantial *executed* steps follow the failure. Read the job's step list first (metadata the jobs listing already returned): when the steps after the failing one are skipped or trivial, a modest `tail_lines` on that single `job_id` reaches it in one call, and the run-logs zip is only needed when real output follows.
