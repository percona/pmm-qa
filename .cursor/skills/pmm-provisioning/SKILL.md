---
name: pmm-provisioning
description: Provision PMM Server and monitored databases on the Cursor Cloud MicroVM — docker network pmm-qa, watchtower, readyz, qa-integration pmm-framework, IS_CURSOR_VM. Use when setting up PMM for manual QA or reproducing FB test environment on the agent VM.
---

# PMM provisioning (Cursor Cloud / MicroVM)

MicroVM uses the **same** `qa-integration/pmm_qa/pmm-framework/pmm-framework` as Jenkins/EC2, with `IS_CURSOR_VM=1` (set automatically by `.cursor/environment.json` `start`).

Resolve repo root:

```bash
QA_ROOT="${PWD}"
[ -d pmm-qa ] && QA_ROOT="${PWD}/pmm-qa"
FRAMEWORK="${QA_ROOT}/qa-integration/pmm_qa/pmm-framework/pmm-framework"
```

## Runbook

Read [references/MANUAL-QA-MICROVM.md](references/MANUAL-QA-MICROVM.md). Setup inventory: [references/SETUP-INVENTORY.md](references/SETUP-INVENTORY.md).

## Server (MicroVM)

Docker and Ansible bootstrap run from `.cursor/environment.json` (`install` + `start`).  
`IS_CURSOR_VM=1` and `PMM_QA_NO_SYSTEMD=1` are exported on agent start.

```bash
export DOCKER_VERSION=...          # from FB JNKPercona comment
export WATCHTOWER_VERSION=...      # optional with --skip-watchtower
export CLIENT_VERSION='...'        # client tarball URL (for databases step)
export ADMIN_PASSWORD='pmm3admin!'
export DOCKER_ENV_VARIABLE='-e PMM_DEBUG=1 -e PMM_ENABLE_TELEMETRY=0'  # override per ticket
```

Provision PMM Server (see [MANUAL-QA-MICROVM.md](references/MANUAL-QA-MICROVM.md) for full commands):

```bash
docker network create pmm-qa 2>/dev/null || true
docker volume create pmm-data 2>/dev/null || true
mkdir -m 777 -p /tmp/backup_data
docker pull "$DOCKER_VERSION"
docker rm -f pmm-server watchtower 2>/dev/null || true
# optional watchtower — see runbook
docker run -d --restart=always --name pmm-server --hostname pmm-server \
  --network pmm-qa -p 443:8443 -p 4647:4647 -v pmm-data:/srv \
  -e "GF_SECURITY_ADMIN_PASSWORD=${ADMIN_PASSWORD}" \
  $DOCKER_ENV_VARIABLE \
  "$DOCKER_VERSION"
# wait for readyz: HTTP 200, body {}
until [ "$(curl -ksS -o /tmp/rz -w '%{http_code}' https://127.0.0.1/v1/server/readyz)" = "200" ] \
  && [ "$(tr -d '[:space:]' </tmp/rz)" = "{}" ]; do sleep 5; done
```

## Databases (after server is up)

```bash
export ADMIN_PASSWORD='pmm3admin!'
export CLIENT_VERSION='...'

"$FRAMEWORK" \
  --pmm-server-password "$ADMIN_PASSWORD" \
  --client-version "$CLIENT_VERSION" \
  --database <FROM_TEST_PLAN> \
  --verbose
```

Pick `--database` from ticket + `qa-integration/pmm_qa/pmm-framework/lib/config.sh` (catalogue) or `./pmm-framework --help`.

## FB workflow reproduction (Test Healer)

Follow `pmm-qa/.github/workflows/runner-e2e-tests-codeceptjs.yml`, `runner-e2e-tests-playwright.yml`, or `runner-integration-cli-tests.yml` — not Jenkins staging.

## UI login (optional)

```bash
"${QA_ROOT}/.cursor/scripts/pmm-ui-login.sh" PMM-<TICKET>
```

## Cleanup

```bash
docker rm -f pmm-server watchtower 2>/dev/null || true
docker ps -aq | xargs -r docker rm -f
docker volume rm pmm-data 2>/dev/null || true
docker network rm pmm-qa 2>/dev/null || true
```

When in doubt: tear down all containers on `pmm-qa` network and remove `pmm-data` after confirming nothing else needs them.
