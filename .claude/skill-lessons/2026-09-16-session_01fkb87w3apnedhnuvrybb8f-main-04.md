# .claude/skills/linode-ha-provisioning/SKILL.md — the PMM-HA-GA chart swap is an upgrade, and helm upgrades neither dependencies, CRDs, nor data directories

- Added: 2026-09-16
- Applies to: target only
- Evidence: Swapping the relay's released install onto the branch charts failed three times in a row: `helm upgrade` refused with "missing in charts/ directory" until each chart's dependency repos were added and `helm dependency build` run; `pmm-ha-dependencies` 1.0.0 -> 1.2.0 then left pg-operator 3.1.0 crash-looping on "no matches for upstream.pgv2.percona.com/v1beta1" until the subchart's own `crds/crd.yaml` was applied; and pg-db 3.1.0's PostgreSQL 18 default refused the existing 17 data directory ("Expected PostgreSQL data version 18 / data version::17") until `pg-db.postgresVersion` and the image were pinned back to 17.
- Proposed change: In the chart-swap section, add the three prerequisites/repairs the swap needs — `helm repo add` + `helm dependency build` for both charts before upgrading, apply the pg-operator subchart's `crds/crd.yaml` (helm never upgrades CRDs), and pin `pg-db.postgresVersion`/image to the major version already on disk.
