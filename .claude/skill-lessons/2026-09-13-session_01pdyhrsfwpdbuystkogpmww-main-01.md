# .claude/agents/investigator.md — read one job's failing step from `/actions/jobs/<id>/logs`, not a grown tail or the run-logs zip

- Added: 2026-09-13
- Applies to: .claude/agents/investigator.md
- Evidence: A setup-step failure (step 11 of 20, `Setup PMM Server`) with every test step after it skipped still was not reached by `get_job_logs` at `tail_lines: 48` nor at `95` — the skipped steps' own `##[group]` env dumps plus the launchable/upload-artifact steps fill that window — and the run-logs zip 404s while the run is still in progress, which it was. One authenticated `curl` to `https://api.github.com/repos/<o>/<r>/actions/jobs/<job_id>/logs` returned the whole 1771-line job log, and `grep -n '##\[group\]Run '` located the step immediately.
- Proposed change: In the log-reading guidance, name the per-job logs endpoint as the route for reading a *specific* failing step: it returns one job's full log in a single request and works whether or not the run has finished, so it covers both the "tail cannot reach it" and "zip 404s mid-run" cases. Keep `get_job_logs` for cheap `failed_only` enumeration; stop at one tail attempt rather than growing it.
