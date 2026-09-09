# .claude/agents/investigator.md — a GitHub Actions job killed by `timeout-minutes` reports `cancelled`, and is decided

- Added: 2026-09-09
- Applies to: any agent triaging GitHub Actions runs
- Evidence: In `package-test-single` run 34288590742 the `ol-10` leg carried `conclusion: cancelled` while the run's own conclusion was `failure`; the job ran 60m13s against `timeout-minutes: 60` (`runner-package-test.yml:115`) and its last step sat 53m in one `dnf install` — a job timeout, not a fail-fast or concurrency cancellation, and a leg reported as `cancelled` that had been treated as still running.
- Proposed change: Note that `timeout-minutes` expiry surfaces as `conclusion: cancelled`, so before attributing a cancelled job to fail-fast or concurrency, compare its duration against the workflow's `timeout-minutes` and read its last step — and never count a `cancelled` leg as undecided.
