# .claude/skills/fb-tests/SKILL.md — Filter skipped/cancelled steps before computing step durations

- Added: 2026-09-11
- Applies to: .claude/skills/fb-tests/SKILL.md ("Reading history in bulk")
- Evidence: Deriving a setup step's duration from `started_at`/`completed_at` across pmm-qa e2e matrix runs produced 139 zero-second rows out of 990; all 139 were steps whose own `conclusion` was `skipped`, and treating them as real datapoints yielded "fastest 0s" examples that inverted the fast-vs-slow comparison until the step conclusion was checked.
- Proposed change: Instruct that step timings be segmented by the step's own `conclusion` — drop `skipped` (always 0s) and flag `cancelled` (truncated, not representative) — before computing any min/median/max or fast-vs-slow comparison.
