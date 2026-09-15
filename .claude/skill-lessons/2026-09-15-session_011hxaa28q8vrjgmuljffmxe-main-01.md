# .claude/skills/linode-docker-provisioning/SKILL.md — read QAN data on the box straight from ClickHouse, with the right user

- Added: 2026-09-15
- Applies to: .claude/skills/linode-docker-provisioning/SKILL.md (also relevant to `.claude/skills/fb-tests/SKILL.md`)
- Evidence: Explaining a QAN query-count failure needed the per-digest rows. A bare `clickhouse-client` and `--user clickhouse --password clickhouse` both failed with `AUTHENTICATION_FAILED`; the container's env advertises `CLICKHOUSE_PASSWORD="clickhouse"` but the matching user is `default`, so `docker exec pmm-server clickhouse-client --user default --password clickhouse --database pmm --query ...` is what works. Querying `metrics` (queryid, fingerprint, schema, service_name, agent_type, example, num_queries, period_start) then named the extra digest in one call.
- Proposed change: Beside the existing "Checking what actually registered" inventory recipe, add a QAN one — the working `clickhouse-client` invocation with `--user default`, a note that the advertised `CLICKHOUSE_PASSWORD` does not name its user, and that `pmm.metrics` is what QAN's "of N items" count reflects.
