---
name: pmm-provisioning
description: Provision PMM Server and monitored databases on the Cursor Cloud MicroVM — docker network pmm-qa, watchtower, readyz, cursor-qa-integration pmm-framework, IS_CURSOR_VM, provision-pmm.sh. Use when setting up PMM for manual QA or reproducing FB test environment on the agent VM.
---

# PMM provisioning (Cursor Cloud / MicroVM)

**Cursor-only path** — scripts live under `cursor-qa-integration/`. Do **not** modify `qa-integration/` (Jenkins/EC2).

Resolve repo root:

```bash
QA_ROOT="${PWD}"
[ -d pmm-qa ] && QA_ROOT="${PWD}/pmm-qa"
CURSOR_QA="${QA_ROOT}/cursor-qa-integration"
```

## Runbook

Read [references/MANUAL-QA-MICROVM.md](references/MANUAL-QA-MICROVM.md). Setup inventory: [references/SETUP-INVENTORY.md](references/SETUP-INVENTORY.md).

## Server (MicroVM)

```bash
export DOCKER_VERSION=...          # from FB JNKPercona comment
export WATCHTOWER_VERSION=...
export CLIENT_VERSION='...'        # client tarball URL
export ADMIN_PASSWORD='pmm3admin!'
export DOCKER_ENV_VARIABLE='-e PMM_DEBUG=1 -e PMM_ENABLE_TELEMETRY=0'  # override per ticket

"$CURSOR_QA/scripts/provision-pmm.sh" --cleanup --fresh-volume
```

**readyz:** `https://127.0.0.1/v1/server/readyz` → HTTP **200**, body `{}`.

## Databases (after server is up)

```bash
export IS_CURSOR_VM=1
export ADMIN_PASSWORD='pmm3admin!'
export CLIENT_VERSION='...'

"$CURSOR_QA/pmm_qa/run-framework.sh" \
  --pmm-server-password "$ADMIN_PASSWORD" \
  --client-version "$CLIENT_VERSION" \
  --database <FROM_TEST_PLAN> \
  --verbose
```

Pick `--database` from ticket + `qa-integration/pmm_qa/scripts/database_options.py` (shared catalog).

## FB workflow reproduction (Test Healer)

Follow `pmm-qa/.github/workflows/runner-e2e-tests-codeceptjs.yml`, `runner-e2e-tests-playwright.yml`, or `runner-integration-cli-tests.yml` — not Jenkins staging.

## Cleanup

Remove **all** Docker resources used for the run (containers, volumes, networks). Setup varies by ticket — do not assume a single compose file:

```bash
"$CURSOR_QA/scripts/cleanup-pmm-microvm.sh"
# or re-provision from scratch:
"$CURSOR_QA/scripts/provision-pmm.sh" --cleanup --fresh-volume
```

When in doubt: `docker ps -aq | xargs -r docker rm -f` and remove `pmm-qa` network / `pmm-data` volume after confirming nothing else needs them.
