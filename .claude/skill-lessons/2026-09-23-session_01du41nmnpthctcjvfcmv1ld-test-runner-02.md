# .claude/skills/linode-ha-provisioning/SKILL.md — on PMM-HA-GA, query metric ranges through the Grafana datasource proxy

- Added: 2026-09-23
- Applies to: .claude/skills/linode-ha-provisioning/SKILL.md
- Evidence: On the PMM-HA-GA chart, `/prometheus/api/v1/query_range` through HAProxy returned "victoriametrics_pmm missing route"; `/graph/api/datasources/proxy/uid/<vm-datasource-uid>/api/v1/query_range` returned the data.
- Proposed change: In the verification section, give the Grafana datasource-proxy path as the way to run PromQL range queries on an HA install.
