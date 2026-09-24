# .claude/skills/add-ha-test/SKILL.md — never assert an even skew for a ScheduleAnyway spread, nor any spread after a scale-down

- Added: 2026-09-24
- Applies to: target only
- Evidence: On a 4-node LKE cluster with the PMM-HA-GA HAProxy `topologySpreadConstraints` (maxSkew 1, ScheduleAnyway), 9 replicas landed 2/3/1/3 (the node running two PMM pods got one), and scaling 6 -> 3 left 2/1/0/0, so a skew <= 1 assertion failed on product behaviour that is correct.
- Proposed change: Say that a ScheduleAnyway spread only guarantees "every schedulable node gets a pod before any gets two" on a scale-up from an even start, and that Deployment scale-down never rebalances, so assert pod counts there, not placement.
