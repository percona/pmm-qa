---
name: pmm-linode-provisioning
description: Provision PMM Server and monitored databases on a throwaway Linode VM using Terraform and the unmodified qa-integration bash pmm-framework. Use when setting up PMM for manual QA or reproducing an FB test environment for a cloud agent run.
---

# PMM provisioning (Linode)

Uses the **same** bash `qa-integration/pmm_qa/pmm-framework/pmm-framework` as Jenkins/EC2/CI — no wrapper scripts, no forked playbooks, no changes to `qa-integration/` ever. A real Linode VM (full kernel, full systemd, real Docker) replaces this session's own constrained sandbox for anything that needs to run containers — that sandbox is fine for reading code and talking to Jira/GitHub, but PMM + monitored databases need a real Docker host.

Full implementation reference: [terraform/linode-runner/README.md](../../../terraform/linode-runner/README.md).

## Never code on the Linode VM

The VM is purely an execution target — it runs Docker/Ansible, nothing else. All code changes (fixes, new tests, playbook edits) happen in this Claude Code environment, where they're tracked by git from the first keystroke. If a change needs to run on the box, **commit and push it to a branch first**, then point the box at that branch (`PMM_QA_REF=<branch> up.sh ...`, or `sync.sh <run_id> <branch>` on an already-running one). Never exec in and edit files directly — anything written only on the VM's disk is gone the moment the instance is destroyed or self-destructs, with no way to recover it.

## Why HTTPS-exec, not SSH

`run.sh` talks to the box over a small bearer-token-authenticated HTTPS service (`up.sh` provisions it via cloud-init), not SSH. This isn't a style choice — confirmed live, twice:

- Raw SSH (port 22) never reaches the VM from a cloud-session environment, at **any** network access level (None/Trusted/Full/Custom) — the platform's own security proxy is HTTP/HTTPS-only, and that's true regardless of what the environment's network-access setting is configured to. No environment config fixes this.
- Moving the exec-server to a non-443 port doesn't work either: the `CONNECT` tunnel itself succeeds, but the TLS handshake gets reset immediately after the ClientHello — something inspects traffic per-port and kills anything on a port that doesn't look like standard port-443 HTTPS, even through an already-established tunnel.

So port 443 is the only port that reliably carries real traffic out of this kind of environment, and everything — provisioning, running commands, tearing down — goes through it via `run.sh`. One consequence: **PMM Server itself can't also bind host port 443** (see step 2) without conflicting with the exec-server, so it binds an internal-only port instead — see the UI caveat in step 4.

The box must always be addressed by a hostname derived from its IP (`<ip-with-dashes>.nip.io`, which `run.sh`/`up.sh` already do for you) — the same proxy drops connections to a bare IP address outright, needing a hostname (SNI/Host) to route at all. Never hand-construct a `https://<ip>/...` URL against this box from the controller side.

## Pick a run_id

Something unique and traceable: the Jira key (`PMM-15196`) for Test Runner, `heal-<submodules-pr>` for FB Validator, or `nightly-<workflow>-<date>` for Test Doctor. Reused as the Linode instance label/tags, and as the key the self-destruct timer uses to find its own instance.

## 1. Provision the VM

```bash
export LINODE_TOKEN=...   # already in this environment's secrets; never print it or write it to a file
terraform/linode-runner/up.sh <role> <run_id>
```

`role` is `test-runner`, `test-doctor`, or `fb-validator` (free text, just for the tag). This:
- Creates a Linode VM (default `g6-standard-6`, Ubuntu 24.04) with a firewall open only on 443 (the exec-server — see "Why HTTPS-exec, not SSH" above), tagged `pmm-qa-ephemeral`.
- Waits for the exec-server to answer, then for cloud-init to finish installing Docker + Ansible and scheduling its own self-destruct timer (default 24h — see Cleanup below).
- `git clone`s `percona/pmm-qa` onto the box at `/root/pmm-qa` — `main` by default, or whatever `PMM_QA_REF` names (must already be pushed; see "Never code on the Linode VM" above).

Works from the **default** proxied-HTTPS environment — no special network policy needed, unlike the old SSH-based version of this skill. Takes 2-4 minutes. Prints the VM's IP on success.

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
    --network pmm-qa -p 8443:8443 -p 4647:4647 -v pmm-data:/srv \
    -e GF_SECURITY_ADMIN_PASSWORD='$ADMIN_PASSWORD' \
    $DOCKER_ENV_VARIABLE \
    '$DOCKER_VERSION'
"
```

`-p 8443:8443`, not `443:8443` — host port 443 is the exec-server's (see "Why HTTPS-exec, not SSH"), so PMM binds an internal-only port instead. Client containers on the same `pmm-qa` docker network still reach it by container hostname (`pmm-server`) at its native port regardless of the host mapping — see step 3.

Wait for **readyz**: HTTP **200**, body **`{}`**, checked from *inside* the box (this is loopback traffic on the VM, not a controller-to-VM connection, so it's unaffected by anything above):

```bash
terraform/linode-runner/run.sh <run_id> -- "
  until code=\$(curl -ksS -o /tmp/rz -w '%{http_code}' https://127.0.0.1:8443/v1/server/readyz) \
    && [ \"\$code\" = 200 ] && [ \"\$(tr -d '[:space:]' </tmp/rz)\" = '{}' ]; do
    sleep 5
  done
  echo 'PMM Server ready'
"
```

## 3. Databases (ticket-specific, after server is up)

```bash
terraform/linode-runner/run.sh <run_id> -- "
  cd pmm-qa/qa-integration/pmm_qa/pmm-framework && \
  ADMIN_PASSWORD='$ADMIN_PASSWORD' CLIENT_VERSION='$CLIENT_VERSION' \
  ./pmm-framework --pmm-server-password \"\$ADMIN_PASSWORD\" \
    --client-version \"\$CLIENT_VERSION\" \
    --database <FROM_TEST_PLAN> --verbose
"
```

Pick `--database` from the ticket + [references/SETUP-INVENTORY.md](references/SETUP-INVENTORY.md), or `pmm-framework --help` on the box.

## 4. UI — currently blocked, known gap

Local Playwright/Chromium (`pmm-ui-evidence`) needs to reach PMM's own UI directly from the controller over HTTPS — but PMM now binds an internal-only port (see step 2), precisely because host port 443 is already the exec-server's. There is no external port for the controller's browser to hit today.

Not silently worked around: this is an open gap, not something to route around by moving the exec-server to another port (already tried live — see "Why HTTPS-exec, not SSH") or by reverting PMM to host port 443 (breaks the exec-server that the box depends on for everything else). A shared-port design (an nginx SNI-passthrough router in front of both, so the exec-server and PMM's UI coexist on the one usable port) would close this, but hasn't been built. Until it is, treat verification steps that need a direct browser hit against the box's own UI as unsupported — API/CLI/log/DB-query based verification (as used for e.g. `pmm-encryption-rotation` checks) works fully today and doesn't hit this limitation.

## 5. FB / nightly workflow reproduction (FB Validator, Test Doctor)

Follow `pmm-qa/.github/workflows/runner-e2e-tests-codeceptjs.yml`, `runner-e2e-tests-playwright.yml`, or `runner-integration-cli-tests.yml` for the exact steps — not Jenkins staging. If the fix under test lives on a branch, push it, then `up.sh`/`sync.sh` with `PMM_QA_REF` set to that branch — never patch it in by hand on the box.

## 6. Running longer than expected?

```bash
terraform/linode-runner/extend.sh <run_id> <more_hours>
```

Reschedules the self-destruct timer on the live instance instead of losing it mid-investigation. Ask before extending someone else's run.

## 7. Cleanup — mandatory, every path

```bash
terraform/linode-runner/down.sh <run_id>
```

Call this whether the run passed, failed, or was blocked — it's the primary, immediate cleanup mechanism. The instance also self-destructs on its own after `ttl_hours` (default 24h) regardless, via an on-box systemd timer — no external reaper process, no scheduled Routine, nothing that could mistakenly delete a still-active run out from under someone. Never skip `down.sh` anyway: an unterminated Linode VM keeps costing money for however long is left before its own timer fires.

## Known limits

None specific to the VM itself — it is a real kernel with real systemd, so playbooks that need `antmelekhin/docker-systemd`-style images work normally (this is the whole reason this setup exists instead of running inside the agent's own sandbox). If a setup still fails, it is a genuine `qa-integration` bug — report it, do not fork around it here.

Direct browser access to PMM's own UI from the controller doesn't work today — see the UI caveat in step 4. Everything else (provisioning, `pmm-framework`, `pmm-admin`, log/DB checks, `pmm-encryption-rotation`) works from the default network policy; no special environment configuration needed.
