# MicroVM manual QA — agent reference

Condensed runbook for the PMM manual QA cloud agent on Cursor MicroVM.
**Do not freestyle `docker run` or `curl` loops** — use `cursor-qa-integration/` scripts.

## 1. Server (always first)

```bash
QA_ROOT="${PWD}"; [ -d pmm-qa ] && QA_ROOT="${PWD}/pmm-qa"

export DOCKER_VERSION=...          # FB: Server docker
export WATCHTOWER_VERSION=...      # FB: Watchtower docker (optional with --skip-watchtower)
export CLIENT_VERSION='...'        # FB: Client tarball URL (for step 2)
export ADMIN_PASSWORD='pmm3admin!'
export DOCKER_ENV_VARIABLE='-e PMM_DEBUG=1 -e PMM_ENABLE_TELEMETRY=0'  # override per ticket

"$QA_ROOT/cursor-qa-integration/scripts/provision-pmm.sh" --cleanup --fresh-volume
```

- Starts Docker via `start-docker-microvm.sh`
- Jenkins `pmm3-aws-staging-start` server parity (`--hostname pmm-server`, watchtower token `testToken`)
- **readyz:** `https://127.0.0.1/v1/server/readyz` → HTTP **200**, body **`{}`** (not `grep ok`)
- **Do not** run `pmm3-client-setup.sh` on MicroVM (GHA pattern; clients live in DB containers via `pmm-framework.py`)

## 2. Databases (ticket-specific, after server is up)

```bash
export IS_CURSOR_VM=1               # set in Cursor automation secrets
export ADMIN_PASSWORD='pmm3admin!'
export CLIENT_VERSION='...'

"$QA_ROOT/cursor-qa-integration/pmm_qa/run-framework.sh" \
  --pmm-server-password "$ADMIN_PASSWORD" \
  --client-version "$CLIENT_VERSION" \
  --database <TICKET_SPECIFIC> \
  --verbose
```

Pick `--database` from test plan + `qa-integration/pmm_qa/scripts/database_options.py`. Examples:

| Ticket scope | `--database` |
|--------------|----------------|
| MongoDB backup/PBM | `psmdb,SETUP_TYPE=pss` |
| MySQL GR | `ps,SETUP_TYPE=gr` |
| PostgreSQL | `pgsql` |
| PSMDB sharded | `psmdb,SETUP_TYPE=sharding` |

**Never** use `mlaunch_psmdb` for backup/PBM tickets (no PBM).

## 3. UI (computer use)

**Do not** open `/graph/login` and type credentials into the Grafana form — use Basic Auth / PMM login flow via **computer use** (cloud agent browser).

Reference selectors and patterns: [.agents/workflows/pmmLogin.md](../../.agents/workflows/pmmLogin.md).

## 4. Reset

Remove all Docker resources from the run:

```bash
"$QA_ROOT/cursor-qa-integration/scripts/cleanup-pmm-microvm.sh"
# or: provision-pmm.sh --cleanup --fresh-volume
```

## Escalation

If `run-framework.sh` fails with RS containers exit 255, ensure **`IS_CURSOR_VM=1`** is set (Cursor automation secret).
If still blocked, report BLOCKED and link Jenkins `pmm3-aws-staging-start` parambuild URL.

## Script map

| Script | Purpose |
|--------|---------|
| `cursor-qa-integration/scripts/provision-pmm.sh` | PMM Server + watchtower |
| `cursor-qa-integration/scripts/lib/wait-pmm-ready.sh` | readyz waiter |
| `cursor-qa-integration/scripts/cleanup-pmm-microvm.sh` | teardown |
| `cursor-qa-integration/scripts/start-docker-microvm.sh` | dockerd on MicroVM |
| `cursor-qa-integration/pmm_qa/run-framework.sh` | databases via forked pmm-framework |
| `cursor-qa-integration/pmm_psmdb-pbm_setup/start-rs-only-microvm.sh` | called via framework when `IS_CURSOR_VM=1` |
