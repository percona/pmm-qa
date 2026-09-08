# .claude/agents/investigator.md — in a fail-fast matrix, find the one job whose own step failed before reading any log

- Added: 2026-09-08
- Applies to: .claude/agents/investigator.md
- Evidence: Nightly run 34233153827 listed 4 `failure` and 11 `cancelled` jobs; `list_workflow_jobs` step data alone showed only `setup / ps-replication` had a step of its own conclude `failure` (the 3 test jobs failed on "Wait for all setup jobs to be ready", the 11 siblings were fail-fast cancellations), so exactly one job's log needed reading.
- Proposed change: In the CI-trigger paragraph, add that on a `fail-fast: true` matrix the root failure is the job whose own step conclusion is `failure` earliest — read step conclusions from `list_workflow_jobs` first and treat `cancelled` siblings and downstream "wait for setup" failures as amplification, not separate failures.
