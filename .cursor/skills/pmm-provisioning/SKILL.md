---
name: pmm-provisioning
description: Provision PMM Server and monitored databases on the cloud MicroVM or local Docker — docker network pmm-qa, watchtower, readyz, pmm-framework.py, IS_CURSOR_VM, provision-pmm.sh. Use when setting up PMM for manual QA or reproducing FB test environment on the agent VM.
---

# PMM provisioning (cloud / MicroVM)

Resolve QA root:

```bash
QA_ROOT="${PWD}"
[ -d pmm-qa ] && QA_ROOT="${PWD}/pmm-qa"
```

## MicroVM path (preferred on Cursor Cloud)

Read [qa-integration/MANUAL-QA-MICROVM.md](../../qa-integration/MANUAL-QA-MICROVM.md).

```bash
export DOCKER_VERSION=...          # from FB JNKPercona comment
export WATCHTOWER_VERSION=...
export CLIENT_VERSION='...'        # client tarball URL
export ADMIN_PASSWORD='pmm3admin!'
export DOCKER_ENV_VARIABLE='-e PMM_DEBUG=1 -e PMM_ENABLE_TELEMETRY=0'  # override per ticket

"$QA_ROOT/qa-integration/scripts/provision-pmm.sh" --cleanup --fresh-volume
```

**readyz:** `https://127.0.0.1/v1/server/readyz` → HTTP **200**, body `{}`.

Databases after server is up:

```bash
cd "$QA_ROOT/qa-integration/pmm_qa" && source virtenv/bin/activate
export IS_CURSOR_VM=1
export ADMIN_PASSWORD='pmm3admin!'
export CLIENT_VERSION='...'

python pmm-framework.py \
  --pmm-server-password "$ADMIN_PASSWORD" \
  --client-version "$CLIENT_VERSION" \
  --database <FROM_TEST_PLAN> \
  --verbose
```

Pick `--database` from ticket + `pmm_qa/scripts/database_options.py`. Set `IS_CURSOR_VM=1` in environment secrets for MicroVM.

## Legacy Docker path (no provision script)

1. `docker network create pmm-qa`
2. `docker volume create pmm-data`
3. Watchtower on `pmm-qa`
4. PMM Server with `DOCKER_ENV_VARIABLE`, admin password
5. Wait readyz
6. `qa-integration/pmm_qa/pmm3-client-setup.sh` (non-MicroVM only)
7. `pmm-framework.py` with `CLIENTS` when needed

## FB workflow reproduction (Test Healer)

Follow `pmm-qa/.github/workflows/runner-e2e-tests-codeceptjs.yml` or `runner-integration-cli-tests.yml` — not Jenkins staging.

## Cleanup

```bash
"$QA_ROOT/qa-integration/scripts/cleanup-pmm-microvm.sh"
```
