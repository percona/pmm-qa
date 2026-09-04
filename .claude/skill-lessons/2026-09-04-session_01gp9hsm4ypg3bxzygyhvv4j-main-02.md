# .claude/agents/investigator.md — when nightly cannot be re-run, the run's own artifacts are the evidence of record

- Added: 2026-09-04
- Applies to: target only
- Evidence: A nightly run's remote PMM Server was destroyed 13 minutes after the run finished, so neither reproduction nor a re-run was possible — the agent file says to "say so and stop". The run's `artifacts_<tag>.zip` still held the server's full log set (`logs/grafana.log`, `logs/pmm-managed.log`, `supervisorctl_status.log`, `client/status.json`), and greps of two of them produced the failing PostgreSQL error verbatim, which was enough to classify the failure and file the product bug. Sibling artifacts of the same run differ ~25x in size (53MB vs 1.3GB) for the same server logs.
- Proposed change: In the nightly exception, before "say so and stop", require pulling the run's own artifacts (`actions_get` → `download_workflow_run_artifact`, smallest artifact that carries `logs/`) and reading the server logs — a directly observed server-side error there is a stronger basis than a re-run would have been, and should be reported as such with the reproduction gap stated.
