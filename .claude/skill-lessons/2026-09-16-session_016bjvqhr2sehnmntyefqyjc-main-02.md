# .claude/agents/investigator.md — `get_job_logs`'s `original_length` is a line count, not bytes

- Added: 2026-09-16
- Applies to: .claude/agents/investigator.md
- Evidence: `get_job_logs` with `failed_only: true` reported `original_length: 4323` for a failed e2e job, read as "4 KB of log, so this job died in setup" — the log was in fact 4323 lines / 429 KB, and the failure was a test assertion three quarters of the way down. The same value is returned regardless of `tail_lines`, so it describes the whole log, not the slice.
- Proposed change: In the log-reading guidance, state that `get_job_logs`'s `original_length` counts lines of the full log (not bytes, not the returned slice), so a small-looking number is not evidence a job failed early — locate the failing step from `##[group]Run` markers instead.
