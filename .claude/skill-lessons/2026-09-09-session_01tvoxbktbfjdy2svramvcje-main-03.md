# .claude/skills/linode-docker-provisioning/SKILL.md — find pmm-admin in a QA database container with `command -v`, and unregister by the agent's own node id

- Added: 2026-09-09
- Applies to: target only
- Evidence: `docker exec ps_pmm_replication_8_0_1 ls /usr/local/percona/pmm/bin` returned "No such file or directory" and suggested the container carried no client, while `command -v pmm-admin` found it at `/usr/sbin/pmm-admin`. Separately, `pmm-admin unregister --help` advertises "autodetected default: mongos" for `--node-name`, but `admin/commands/management/unregister.go` resolves the node from the local agent's `NodeID` when the flag is omitted, so it removed the registered `mongos_16176` rather than the hostname.
- Proposed change: note that pmm-admin sits at `/usr/sbin/pmm-admin` in the QA database containers, so probe with `command -v pmm-admin` rather than a fixed path, and that `pmm-admin unregister --force` without `--node-name` targets the agent's real registered node even when that name differs from the container hostname.
