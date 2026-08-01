# Cursor QA integration

**Cursor Cloud / MicroVM provisioning only.** Jenkins/EC2 paths stay in [`qa-integration/`](../qa-integration/).

MicroVM database setups use the **same** bash `pmm-framework` as Jenkins, with `IS_CURSOR_VM=1` (no duplicate Ansible tree in this folder).

| Path | Purpose |
|------|---------|
| `scripts/provision-pmm.sh` | PMM Server + Docker on MicroVM |
| `scripts/run-framework.sh` | `IS_CURSOR_VM=1` wrapper → `qa-integration/pmm_qa/pmm-framework/pmm-framework` |
| `scripts/run-nightly-setups.sh` | Nightly matrix validation |
| `scripts/cleanup-pmm-microvm.sh` | Tear down PMM + QA containers |

## Usage

```bash
export DOCKER_VERSION=perconalab/pmm-server:3-dev-latest
export CLIENT_VERSION='https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/pmm-client/pmm-client-latest.tar.gz'
export ADMIN_PASSWORD='pmm3admin!'
export IS_CURSOR_VM=1

cursor-qa-integration/scripts/provision-pmm.sh --cleanup --fresh-volume --skip-watchtower

cursor-qa-integration/scripts/run-framework.sh \
  --pmm-server-password "$ADMIN_PASSWORD" \
  --client-version "$CLIENT_VERSION" \
  --database psmdb,SETUP_TYPE=pss \
  --verbose
```

## Do not add setup logic here

MicroVM fixes belong in `qa-integration/` (gated by `IS_CURSOR_VM` / `pmm_qa_no_systemd`). This tree is orchestration only.
