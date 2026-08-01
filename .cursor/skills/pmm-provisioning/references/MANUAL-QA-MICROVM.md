# MicroVM manual QA — agent reference

Condensed runbook for the PMM manual QA cloud agent on Cursor MicroVM.

**Environment bootstrap** (Docker, Ansible, `IS_CURSOR_VM=1`) is in `.cursor/environment.json`.  
**Database provisioning** uses `qa-integration/pmm_qa/pmm-framework/pmm-framework` directly — no wrapper scripts.

## 1. Server (always first)

```bash
QA_ROOT="${PWD}"; [ -d pmm-qa ] && QA_ROOT="${PWD}/pmm-qa"

export DOCKER_VERSION=...          # FB: Server docker
export WATCHTOWER_VERSION=...      # FB: Watchtower docker (optional)
export CLIENT_VERSION='...'        # FB: Client tarball URL (for step 2)
export ADMIN_PASSWORD='pmm3admin!'
export DOCKER_ENV_VARIABLE='-e PMM_DEBUG=1 -e PMM_ENABLE_TELEMETRY=0'  # override per ticket
```

Reset stack (when needed):

```bash
docker rm -f pmm-server watchtower 2>/dev/null || true
docker volume rm pmm-data 2>/dev/null || true
```

Provision:

```bash
docker network create pmm-qa 2>/dev/null || true
docker volume create pmm-data 2>/dev/null || true
mkdir -m 777 -p /tmp/backup_data
docker pull "$DOCKER_VERSION"

# Optional watchtower (skip for pinned FB images):
# docker pull "$WATCHTOWER_VERSION"
# docker run -d --restart=always --name watchtower --network pmm-qa \
#   -p 8080:8080 -v /var/run/docker.sock:/var/run/docker.sock \
#   -e WATCHTOWER_HTTP_API_TOKEN=testToken "$WATCHTOWER_VERSION"

docker rm -f pmm-server 2>/dev/null || true
docker run -d --restart=always --name pmm-server --hostname pmm-server \
  --network pmm-qa -p 443:8443 -p 4647:4647 -v pmm-data:/srv \
  -e "GF_SECURITY_ADMIN_PASSWORD=${ADMIN_PASSWORD}" \
  ${DOCKER_ENV_VARIABLE:-} \
  "$DOCKER_VERSION"
```

Wait for **readyz:** `https://127.0.0.1/v1/server/readyz` → HTTP **200**, body **`{}`**

```bash
until code=$(curl -ksS -o /tmp/pmm-readyz-body.txt -w '%{http_code}' https://127.0.0.1/v1/server/readyz) \
  && [ "$code" = "200" ] && [ "$(tr -d '[:space:]' </tmp/pmm-readyz-body.txt)" = "{}" ]; do
  echo "waiting for readyz... HTTP $code"; sleep 5
done
echo "PMM Server ready"
```

- **Do not** run `pmm3-client-setup.sh` on MicroVM (GHA pattern; clients live in DB containers via pmm-framework)

## 2. Databases (ticket-specific, after server is up)

`IS_CURSOR_VM=1` is set by environment `start`. Verify:

```bash
echo "IS_CURSOR_VM=${IS_CURSOR_VM:-unset}"
```

```bash
export ADMIN_PASSWORD='pmm3admin!'
export CLIENT_VERSION='...'

"$QA_ROOT/qa-integration/pmm_qa/pmm-framework/pmm-framework" \
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

Use cloud agent **computer use** for PMM UI, or:

```bash
"$QA_ROOT/.cursor/scripts/pmm-ui-login.sh" PMM-<TICKET>
```

## 4. Reset

```bash
docker rm -f pmm-server watchtower 2>/dev/null || true
docker ps -aq | xargs -r docker rm -f
docker volume rm pmm-data 2>/dev/null || true
docker network rm pmm-qa 2>/dev/null || true
sudo rm -rf /tmp/backup_data /tmp/minio 2>/dev/null || true
```

## Escalation

If pmm-framework fails with RS containers exit 255, ensure **`IS_CURSOR_VM=1`** is set (environment `start` or export manually).  
If still blocked, report BLOCKED and link Jenkins `pmm3-aws-staging-start` parambuild URL.

## What lives where

| Location | Purpose |
|----------|---------|
| `.cursor/environment.json` | Docker start, virtenv, Ansible collection, `IS_CURSOR_VM` |
| `qa-integration/pmm_qa/pmm-framework/pmm-framework` | database provisioning (same as Jenkins) |
| `qa-integration/pmm_qa/tasks/microvm_container_facts.yml` | MicroVM Ansible overlay |
| `qa-integration/pmm_psmdb-pbm_setup/*.microvm.yaml` | PSMDB compose overlay |
| `.cursor/scripts/pmm-ui-login.sh` | optional Playwright UI session |
