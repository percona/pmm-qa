# .claude/agents/investigator.md — a nightly run whose conclusion is `cancelled` can still hide a genuine test failure

- Added: 2026-09-09
- Applies to: .claude/agents/investigator.md
- Evidence: Run 34381557594 reported conclusion `cancelled` because the setup shards park in "Waiting for tests execution" and are cancelled once the test jobs finish; the `@nightly` test job underneath had failed with ten test failures, which `get_job_logs failed_only` surfaced but the run-level conclusion did not.
- Proposed change: Note in the nightly paragraph that this workflow's run conclusion is often `cancelled` by design (parked setup jobs), so classify from the per-job results, never from the run conclusion.
