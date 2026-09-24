# .claude/skills/linode-ha-provisioning/SKILL.md — relay released install keeps forcing a manual PMM-HA-GA teardown; install the branch at provision time

- Added: 2026-09-24
- Applies to: target only
- Evidence: A fourth run this week (PMM-T2286) repeated the same swap failures already queued — TP secret keys block the pmm-ha upgrade, the pg-operator crash-loops after the deps upgrade, a PerconaPGCluster finalizer hangs the namespace, and a fresh install fails on the stale `crds/` PG CRD (postgresVersion max 17) until the new CRDs are server-side applied — costing ~30 min.
- Proposed change: Since prose alone has not prevented this, have provisioning take the chart source (e.g. a `chart_branch` field the relay passes to `k8s/install_pmm_ha.sh --chart-branch`) so a PMM-HA-GA cluster is installed fresh and no session swaps charts on a released install.
