# .claude/agents/investigator.md — time-bound any wait or retry a setup fix introduces

- Added: 2026-09-02
- Applies to: target only
- Evidence: A setup fix replaced a single fire-and-forget `psql` with a 30-attempt retry loop and added a host-side `docker wait` on that container; the repo's review bot showed that with no connect timeout on `psql` and no bound on `docker wait`, an unreachable container would park every attempt at the kernel TCP timeout and hang the job for its full `timeout-minutes: 90` with no diagnostic — a worse failure mode than the silent one being fixed. The finding was accepted and fixed with `PGCONNECT_TIMEOUT` and `timeout` wrappers.
- Proposed change: In the fix step, require that any wait, retry or poll introduced into setup code carry an explicit time bound (connect timeout on the client, `timeout` around a blocking command) and a distinct message when that bound is hit, since converting a silent failure into a hang trades one bad outcome for a worse one.
