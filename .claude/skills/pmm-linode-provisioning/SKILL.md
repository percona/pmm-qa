---
name: pmm-linode-provisioning
description: Provision PMM Server and monitored databases on a throwaway Linode VM using Terraform and the unmodified qa-integration bash pmm-framework. Use when setting up PMM for manual QA or reproducing an FB test environment for a cloud agent run.
---

# PMM provisioning (Linode)

Uses the **same** bash `qa-integration/pmm_qa/pmm-framework/pmm-framework` as Jenkins/EC2/CI — no wrapper scripts, no forked playbooks, no changes to `qa-integration/` ever. A real Linode VM (full kernel, full systemd, real Docker) replaces this session's own constrained sandbox for anything that needs to run containers — that sandbox is fine for reading code and talking to Jira/GitHub, but PMM + monitored databases need a real Docker host.

Full implementation reference: [terraform/linode-runner/README.md](../../../terraform/linode-runner/README.md).

## Pick a run_id

Something unique and traceable: the Jira key (`PMM-15196`), or `heal-<submodules-pr>` for Test Healer. Reused as the Linode instance label/tags — this is what the reaper safety net and any human auditing spend will see.

## 1. Provision the VM

```bash
export LINODE_TOKEN=...   # already in this environment's secrets; never print it or write it to a file
terraform/linode-runner/up.sh <role> <run_id>
```

`role` is `test-runner` or `test-healer` (free text, just for the tag). This:
- Creates a Linode VM (default `g6-standard-6`, Ubuntu 24.04) with a firewall open on SSH (22) and the PMM UI (443), tagged `pmm-qa-ephemeral` + a TTL the reaper respects.
- Waits for cloud-init to finish installing Docker + Ansible.
- Rsyncs this checkout's `qa-integration/` to the box — whatever this session currently has, including uncommitted changes, is exactly what runs. No separate clone, no pinned ref to drift from.

Requires a session/environment network policy that allows outbound SSH (raw TCP on port 22) to arbitrary hosts — a locked-down policy that only permits proxied HTTPS traffic will not be able to reach the VM at all (confirmed the hard way: not fixable by moving SSH to port 443, since such a policy inspects payloads, not just ports). Use a permissive network policy for the environment this skill runs in.

Takes 2-4 minutes. Prints the VM's IP on success.

## 2. Server (always first)

```bash
export DOCKER_VERSION=...          # from FB JNKPercona comment, or perconalab/pmm-server:3-dev-latest
export WATCHTOWER_VERSION=...      # optional
export CLIENT_VERSION='...'        # client tarball URL (for step 3)
export ADMIN_PASSWORD='pmm3admin!'
export DOCKER_ENV_VARIABLE='-e PMM_DEBUG=1 -e PMM_ENABLE_TELEMETRY=0'  # override per ticket

terraform/linode-runner/run.sh <run_id> -- "
  docker network create pmm-qa 2>/dev/null || true
  docker volume create pmm-data 2>/dev/null || true
  mkdir -m 777 -p /tmp/backup_data
  docker pull '$DOCKER_VERSION'
  docker rm -f pmm-server watchtower 2>/dev/null || true
  docker run -d --restart=always --name pmm-server --hostname pmm-server \
    --network pmm-qa -p 443:8443 -p 4647:4647 -v pmm-data:/srv \
    -e GF_SECURITY_ADMIN_PASSWORD='$ADMIN_PASSWORD' \
    $DOCKER_ENV_VARIABLE \
    '$DOCKER_VERSION'
"
```

Wait for **readyz**: `https://<linode-ip>/v1/server/readyz` → HTTP **200**, body **`{}`**:

```bash
terraform/linode-runner/run.sh <run_id> -- "
  until code=\$(curl -ksS -o /tmp/rz -w '%{http_code}' https://127.0.0.1/v1/server/readyz) \
    && [ \"\$code\" = 200 ] && [ \"\$(tr -d '[:space:]' </tmp/rz)\" = '{}' ]; do
    sleep 5
  done
  echo 'PMM Server ready'
"
```

## 3. Databases (ticket-specific, after server is up)

```bash
terraform/linode-runner/run.sh <run_id> -- "
  cd qa-integration/pmm_qa/pmm-framework && \
  ADMIN_PASSWORD='$ADMIN_PASSWORD' CLIENT_VERSION='$CLIENT_VERSION' \
  ./pmm-framework --pmm-server-password \"\$ADMIN_PASSWORD\" \
    --client-version \"\$CLIENT_VERSION\" \
    --database <FROM_TEST_PLAN> --verbose
"
```

Pick `--database` from the ticket + [references/SETUP-INVENTORY.md](references/SETUP-INVENTORY.md), or `pmm-framework --help` on the box.

## 4. UI

Local Playwright/Chromium, not a remote "computer use" browser — see `pmm-ui-evidence`:

```bash
PMM_URL="https://$(cat terraform/linode-runner/runs/<run_id>/ip)" \
  node .claude/scripts/pmm-ui-login.js <TICKET>
```

## 5. FB workflow reproduction (Test Healer)

Follow `pmm-qa/.github/workflows/runner-e2e-tests-codeceptjs.yml`, `runner-e2e-tests-playwright.yml`, or `runner-integration-cli-tests.yml` for the exact steps — not Jenkins staging.

## 6. Cleanup — mandatory, every path

```bash
terraform/linode-runner/down.sh <run_id>
```

Call this whether the run passed, failed, or was blocked. It is the primary cleanup mechanism — a scheduled `reap.sh` safety net only catches runs where this step never happened (crashed session, abandoned chat). Never skip it: an unterminated Linode VM keeps costing money every hour it's up.

## Known limits

None specific to the VM itself — it is a real kernel with real systemd, so playbooks that need `antmelekhin/docker-systemd`-style images work normally (this is the whole reason this setup exists instead of running inside the agent's own sandbox). If a setup still fails, it is a genuine `qa-integration` bug — report it, do not fork around it here.

The controller's own network policy matters: a heavily locked-down session (proxied-HTTPS-only egress) cannot reach the VM over SSH at all — confirmed live, and not fixable by moving SSH to another port, since that class of policy inspects payloads rather than just filtering by port. Run this skill from a session/environment configured with a permissive network policy.
