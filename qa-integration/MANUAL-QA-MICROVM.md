# MicroVM manual QA — agent reference

Condensed runbook for the PMM manual QA cloud agent on Cursor MicroVM.
**Do not freestyle `docker run` or `curl` loops** — use these scripts.

## 1. Server (always first)

```bash
export DOCKER_VERSION=...          # FB: Server docker
export WATCHTOWER_VERSION=...    # FB: Watchtower docker (optional with --skip-watchtower)
export CLIENT_VERSION='...'      # FB: Client tarball URL (for step 2)
export ADMIN_PASSWORD='pmm3admin!'
export DOCKER_ENV_VARIABLE='-e PMM_DEBUG=1 -e PMM_ENABLE_TELEMETRY=0'  # override per ticket

qa-integration/scripts/provision-pmm.sh --cleanup --fresh-volume
```

- Starts Docker via `start-docker-microvm.sh`
- Jenkins `pmm3-aws-staging-start` server parity (`--hostname pmm-server`, watchtower token `testToken`)
- **readyz:** `https://127.0.0.1/v1/server/readyz` → HTTP **200**, body **`{}`** (not `grep ok`)
- **Do not** run `pmm3-client-setup.sh` on MicroVM (GHA pattern; clients live in DB containers via `pmm-framework.py`)

## 2. Databases (ticket-specific, after server is up)

```bash
cd qa-integration/pmm_qa && source virtenv/bin/activate
export PMM_QA_NO_SYSTEMD=1        # required on MicroVM for PSMDB+PBM
export ADMIN_PASSWORD='pmm3admin!'
export CLIENT_VERSION='...'

python pmm-framework.py \
  --pmm-server-password "$ADMIN_PASSWORD" \
  --client-version "$CLIENT_VERSION" \
  --database <TICKET_SPECIFIC> \
  --verbose
```

Pick `--database` from test plan + `pmm_qa/scripts/database_options.py`. Examples:

| Ticket scope | `--database` |
|--------------|----------------|
| MongoDB backup/PBM | `psmdb,SETUP_TYPE=pss` |
| MySQL GR | `ps,SETUP_TYPE=gr` |
| PostgreSQL | `pgsql` |
| PSMDB sharded | `psmdb,SETUP_TYPE=sharding` |

**Never** use `mlaunch_psmdb` for backup/PBM tickets (no PBM).

## 3. UI (playwright-cli)

**Do not** open `/graph/login` and type credentials — use the login script or `/pmmLogin` workflow.

```bash
export PMM_URL='https://127.0.0.1'
export ADMIN_PASSWORD='pmm3admin!'   # same as step 1
qa-integration/scripts/pmm-ui-login.sh PMM-<TICKET>
```

Opens a **headed** browser by default (visible on `:1` for screen recordings). Opt out: `PMM_UI_HEADED=0`. Repo config: `.playwright/cli.config.json`.

Reuse session `pmm-PMM-<TICKET>` for snapshots/clicks. Full details: [.agents/workflows/pmmLogin.md](../.agents/workflows/pmmLogin.md).

## 4. Reset

```bash
qa-integration/scripts/cleanup-pmm-microvm.sh
# or: provision-pmm.sh --cleanup --fresh-volume
```

## Escalation

If `pmm-framework.py` fails with RS containers exit 255 **before** `PMM_QA_NO_SYSTEMD=1` was set, retry with that env var.
If still blocked, report BLOCKED and link Jenkins `pmm3-aws-staging-start` parambuild URL.

## Script map

| Script | Purpose |
|--------|---------|
| `scripts/provision-pmm.sh` | PMM Server + watchtower |
| `scripts/lib/wait-pmm-ready.sh` | readyz waiter |
| `scripts/cleanup-pmm-microvm.sh` | teardown |
| `scripts/start-docker-microvm.sh` | dockerd on MicroVM |
| `scripts/pmm-ui-login.sh` | PMM UI login via playwright-cli (session `pmm-<TICKET>`) |
| `pmm_psmdb-pbm_setup/start-rs-only-microvm.sh` | called via pmm-framework when `PMM_QA_NO_SYSTEMD=1` |
