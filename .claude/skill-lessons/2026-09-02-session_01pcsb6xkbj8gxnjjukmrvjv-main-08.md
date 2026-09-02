# .claude/agents/investigator.md — cite the CI job, not the run, when a push may supersede it

- Added: 2026-09-02
- Applies to: .claude/agents/investigator.md and .claude/agents/fb-reporter.md
- Evidence: A PR body cited `E2E tests Matrix` run 33650775022 as the confirmation that the fixed test passed. A review follow-up commit pushed ~45 minutes later cancelled that run's three still-running jobs, so the run's own conclusion became `cancelled` while the cited job had completed `success` well before — the body had to be reworded to name the job, its conclusion and its completion time.
- Proposed change: When quoting a branch's CI as evidence, name the specific job with its conclusion and completion timestamp (from `actions_get` `get_workflow_job`) rather than the run's conclusion, and note that a later push cancels in-flight jobs and flips the run-level conclusion.
