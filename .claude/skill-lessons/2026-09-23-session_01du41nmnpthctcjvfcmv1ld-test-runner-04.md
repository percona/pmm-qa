# .claude/skills/linode-ha-provisioning/SKILL.md — fresh PMM-HA-GA install over a relay cluster needs a full teardown of the released install first

- Added: 2026-09-23
- Applies to: .claude/skills/linode-ha-provisioning/SKILL.md
- Evidence: The relay always installs the released chart; a fresh branch install worked only after removing both Helm releases, CRs, PVCs, all operator CRDs and the namespace (a perconapgbackups object kept its finalizer after the operator was gone and blocked CRD/namespace deletion until cleared), then pre-creating pmm-secret with PMM_HA_VM_* keys because secret.create=true fails on a fresh install.
- Proposed change: Add an ordered fresh-install recipe (teardown incl. finalizer clear, pre-create pmm-secret, helm install both branch charts) as the default PMM-HA-GA path.
