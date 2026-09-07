# .claude/skills/linode-ha-provisioning/SKILL.md — the default 3-node cluster no longer fits 3 PMM replicas on the branch chart

- Added: 2026-09-07
- Applies to: target only
- Evidence: After upgrading to the PMM-HA-GA `pmm-ha` chart (1.6.2), which adds a 3-pod `pmm-ha-client` StatefulSet, `pmm-ha-1` stayed `Pending` on the relay's default 3-node cluster with `0/3 nodes are available: 3 Insufficient cpu, 3 Insufficient memory` at the chart's default `pmmResources` request of 2 CPU / 4Gi. Setting `pmmClient.replicas=0` and `pmmResources.requests={cpu:1,memory:2Gi}` was needed to reach 3/3 ready — and the `Pending` pod kept its old 2 CPU / 4Gi request until it was deleted by hand, since the StatefulSet controller does not re-create a Pending pod on a template change.
- Proposed change: Extend the existing "ask for node_count 4" note so it covers a plain 3-replica run on the branch chart (not only the 5-pod PMM-T2124 case), and add that a `Pending` StatefulSet pod must be deleted to pick up reduced requests.
