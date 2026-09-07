# .claude/agents/investigator.md — a failing run's Playwright trace artifact answers timing questions before any VM exists

- Added: 2026-09-07
- Applies to: .claude/agents/investigator.md
- Evidence: The `artifacts_*` artifact of the failing nightly carried the scenario's `*.failed.zip` Playwright trace; parsing `trace.trace` (newline-delimited JSON) for `before`/`after` call events and `frame-snapshot` `frameUrl` values showed the awaited URL was already correct 1.2 s before the wait even started, ruling out the timing hypothesis before provisioning anything.
- Proposed change: In the CI/FB trigger sections, note that a codeceptjs/Playwright failure's trace zip inside the run's `artifacts_*` artifact gives a millisecond timeline (`before`/`after` events, `frame-snapshot` `frameUrl`) of when state actually changed relative to when the wait ran, and should be read before adopting or discarding a timing explanation.
