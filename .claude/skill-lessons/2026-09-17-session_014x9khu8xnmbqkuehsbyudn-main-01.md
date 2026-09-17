# .claude/agents/investigator.md — measure a bounded wait's normal duration before treating its timeout as a timing failure

- Added: 2026-09-17
- Applies to: .claude/agents/investigator.md
- Evidence: An FB setup step failed at a 60s bounded wait (`Wait for redis exporter metrics endpoint`, rc=124); on the repro box the same start-and-wait pair satisfied in 0.17-0.71s across 15 trials at load levels 0/6/12/24/48 CPU hogs on 6 vCPU (load average up to 9), so the budget was ~85x the worst observed duration.
- Proposed change: In the loaded-repro guidance, require measuring how long the wait normally takes to satisfy before sweeping load — a bound that fails while normally completing in a tiny fraction of it indicates the awaited process died or never started (look at how it is launched, e.g. a detached `docker exec ... nohup ... &`), not contention, and load sweeping cannot reproduce it.
