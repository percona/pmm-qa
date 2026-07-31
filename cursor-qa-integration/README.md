# Cursor QA integration

**Cursor Cloud / MicroVM provisioning only.** This tree is separate from [`qa-integration/`](../qa-integration/) so Jenkins and EC2 setups are never affected by Cursor-specific changes.

| Path | Purpose |
|------|---------|
| `scripts/` | `provision-pmm.sh`, `cleanup-pmm-microvm.sh`, `pmm-ui-login.sh`, docker helpers |
| `pmm-framework/` | MicroVM entrypoint wrapping upstream bash `qa-integration/pmm_qa/pmm-framework/pmm-framework` |
| `pmm_qa/` | Ansible overlays merged at runtime (`IS_CURSOR_VM`, `PMM_QA_NO_SYSTEMD`, ubuntu base image) |
| `pmm_psmdb-pbm_setup/` | No-systemd PSMDB+PBM compose and entrypoints |
| `MANUAL-QA-MICROVM.md` | Runbook — canonical copy in `.cursor/skills/pmm-provisioning/references/MANUAL-QA-MICROVM.md` |
| `SETUP-INVENTORY.md` | Full setup catalog + MicroVM pass/fail inventory |

## Usage (cloud agent)

```bash
QA_ROOT="${PWD}"; [ -d pmm-qa ] && QA_ROOT="${PWD}/pmm-qa"
CURSOR_QA="${QA_ROOT}/cursor-qa-integration"

export DOCKER_VERSION=...
export CLIENT_VERSION='...'
export ADMIN_PASSWORD='pmm3admin!'

"$CURSOR_QA/scripts/provision-pmm.sh" --cleanup --fresh-volume

"$CURSOR_QA/pmm_qa/run-framework.sh" \
  --pmm-server-password "$ADMIN_PASSWORD" \
  --client-version "$CLIENT_VERSION" \
  --database <FROM_TICKET> \
  --verbose
```

`run-framework.sh` execs the bash framework from `qa-integration/` and merges MicroVM Ansible overlays from `pmm_qa/` (no Python fork).

## Do not modify `qa-integration/`

All Cursor drift belongs here. When a fix is needed for both Jenkins and Cursor, land the Jenkins-safe change in `qa-integration/` first, then mirror or adapt in this tree.
