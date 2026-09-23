# .claude/skills/linode-ha-provisioning/SKILL.md — 1.6.x → PMM-HA-GA swap also needs pmm-secret key rename; PG monitoring secret name changes

- Added: 2026-09-23
- Applies to: .claude/skills/linode-ha-provisioning/SKILL.md
- Evidence: Upgrading a relay-installed pmm-ha 1.6.1 to PMM-HA-GA 1.8.0 needed pmm-secret keys `VMAGENT_remoteWrite_basicAuth_*` renamed to `PMM_HA_VM_USERNAME/PASSWORD`, in addition to the already-recorded CRD apply and PostgreSQL 17 pin; the default PG monitoring secret also moved from `pg-pmm-secret` to `pmm-ha-pg-db-pmm-secret`, leaving the old token live in Grafana.
- Proposed change: Fold these into one ordered swap checklist alongside the CRD and postgresVersion steps (recurrence of the existing swap entry).
