# .claude/skills/fb-tests/SKILL.md — read run_attempt before treating a red job as a test failure

- Added: 2026-09-02
- Applies to: target only
- Evidence: An FB run reported as failed was on `run_attempt: 3`; `actions_get` `get_workflow_job` on the attempt-1 job showed it died at the `Run Setup for E2E Tests` step with the test step skipped, while the attempt-2 job of the same name failed inside the test. Reading only the latest jobs would have described one recurring failure, and the attempt count also revealed that a re-run had already been spent before this investigation started.
- Proposed change: In "Collect checks", say to read the run's `run_attempt` and, when it is above 1, compare jobs across attempts (`actions_list` `list_workflow_jobs` and `actions_get` `get_workflow_job` for the step-level conclusions) — a setup-step failure and a test failure under the same job name are different failures, and the attempt count tells you how many re-runs are already spent.
