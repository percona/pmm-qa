# .claude/agents/investigator.md — compare the same step's duration across sibling matrix shards before calling a timing failure shard-specific

- Added: 2026-09-08
- Applies to: .claude/agents/investigator.md
- Evidence: One identical 170 MB download in the same run took 1m15s (`mysql`), 2m16s (`pgsql`), 8m18s (`pxc`, 42 s inside a 9 m wall) and never finished (`ps-replication`), which established a marginal budget for every shard rather than a fault in one — and identified `pxc` as a near-miss that a pass/fail reading hides.
- Proposed change: Add to the classification rules that for a duration- or throughput-shaped failure, the same step's timings on the sibling shards of the same run are first-class evidence, and a sibling that passed just inside the budget is a finding to report, not a pass.
