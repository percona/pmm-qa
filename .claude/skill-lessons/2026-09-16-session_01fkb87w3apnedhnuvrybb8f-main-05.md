# .claude/skills/linode-ha-provisioning/SKILL.md — no recipe for a second PMM HA instance, and ClickHouse has a hard 2-replica floor

- Added: 2026-09-16
- Applies to: target only
- Evidence: A second instance needed steps the skill does not mention (dependencies chart installed once since its operators watch all namespaces, `pmm-secret` copied into the new namespace before install, distinct release name, `prometheus-node-exporter.enabled=false`), and sizing it down to one ClickHouse replica left PMM permanently unready with qan-api2 looping on "Waiting for ClickHouse cluster to be ready... (system.clusters where remote_hosts > 0)".
- Proposed change: Add a short multi-namespace subsection with those four install steps, and state that ClickHouse must keep at least 2 replicas because qan-api2 blocks on `sum(is_local = 0) > 0` — so a slimmed second instance saves resources elsewhere.
