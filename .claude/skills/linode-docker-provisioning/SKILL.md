---
name: linode-docker-provisioning
description: Provision PMM Server and monitored databases as single-server Docker on a throwaway Linode VM, using Terraform and the unmodified qa-integration bash pmm-framework. This is the default PMM deployment for QA — use it for setting up PMM for manual QA or reproducing an FB test environment, unless the change needs HA (see test-scope / linode-ha-provisioning).
---

# PMM provisioning (Linode, single-server Docker)

This is the **default** deployment for PMM QA: one PMM Server container on one Linode VM. For HA (Kubernetes / multiple replicas) use [`linode-ha-provisioning`](../linode-ha-provisioning/SKILL.md) instead; the [`test-scope`](../test-scope/SKILL.md) skill decides which a given change needs.

Uses the **same** bash `qa-integration/pmm_qa/pmm-framework/pmm-framework` as Jenkins/EC2/CI — no wrapper scripts, no forked playbooks, no changes to `qa-integration/` ever. A real Linode VM (full kernel, full systemd, real Docker) replaces this session's own constrained sandbox for anything that needs to run containers — that sandbox is fine for reading code and talking to Jira/GitHub, but PMM + monitored databases need a real Docker host.

Full implementation reference: [terraform/linode-runner/README.md](../../../terraform/linode-runner/README.md).

## Never code on the Linode VM

The VM is purely an execution target — it runs Docker/Ansible, nothing else. All code changes (fixes, new tests, playbook edits) happen in this Claude Code environment, where they're tracked by git from the first keystroke. If a change needs to run on the box, **commit and push it to a branch first**, then point the box at that branch (`PMM_QA_REF=<branch> up.sh ...`, or `sync.sh <run_id> <branch>` on an already-running one). Never exec in and edit files directly — anything written only on the VM's disk is gone the moment the instance is destroyed or self-destructs, with no way to recover it.

## Accessing the VM

There's no SSH on this box. `run.sh` runs commands over a small bearer-token-authenticated HTTPS service instead (the relay provisions it via cloud-init) — you won't normally touch this directly, just use `run.sh`/`sync.sh`/`extend.sh` (all session-side, via the local `exec_token`); teardown is the relay's `/linode/destroy` (step 7).

Always address the box by hostname, never its bare IP:

- `exec-<ip-with-dashes>.nip.io` — the exec-server (`run.sh`/`up.sh` construct this for you)
- `<ip-with-dashes>.nip.io` (no prefix) — PMM Server's own UI/API, once it's up (step 2)

Both share port 443 (nginx routes by SNI hostname) and are reachable at the same time.

## Pick a run_id

Something unique and traceable: the Jira key (`PMM-15196`) for Test Runner, or for Investigator — `heal-<submodules-pr>` when investigating an FB Tests red, `nightly-<workflow>-<date>` when investigating its own scheduled CI. Reused as the Linode instance label/tags, and as the key the self-destruct timer uses to find its own instance.

## 1. Provision the VM (via the relay)

The `LINODE_TOKEN` no longer lives in this environment — it lives only on the
relay. This env holds a **single** scoped var, `RELAY_KEY`. The relay's URL is a
fixed public hostname (the reserved-IP box), so it's hardcoded, not an env var.
The relay runs `up.sh` with its own token, keeps the Terraform state, and
returns only *this run's* `{ip, exec_token, exec_cert_pem}` — everything
`run.sh` needs to reach the box. The account token never enters this
environment.

**Identity:** every broker call carries your GitHub login in `X-Actor`. The relay
checks it against the team roster (the `github` logins in its people files) and
records who acted — so the audit always names a real person, no self-reported
email. `RELAY_KEY` is the possession gate; `X-Actor` is the identity.

**Get your login the portable way:** call the GitHub MCP `get_me` tool and read
`.login`, then `export ACTOR=<that login>` before the block below. Routine-fired
sessions have **no `gh` CLI**, so `gh api user` returns empty there and the relay
would 401 on an empty actor — `gh` is only a fallback where it actually exists.

```bash
RELAY=https://139-162-176-43.ip.linodeusercontent.com   # fixed prod relay (reserved IP)
RUN_ID=<run_id>                       # e.g. PMM-15196 (see "Pick a run_id")
ROLE=<role>                           # test-runner or investigator (safe id: [A-Za-z0-9._-], tag only)
RUN_DIR="terraform/linode-runner/runs/$RUN_ID"
mkdir -p "$RUN_DIR"
# X-Actor is your GitHub login — set ACTOR from the GitHub MCP get_me (.login) first.
# gh is a fallback only where present; fail closed on an empty actor (the relay 401s it).
command -v gh >/dev/null && ACTOR="${ACTOR:-$(gh api user --jq .login)}"
[ -n "$ACTOR" ] || { echo "ACTOR unset — set it from the GitHub MCP get_me .login" >&2; exit 1; }

# ttl_hours + pmm_qa_ref are optional; add keep-alive handling below.
# 1) Kick off the build — returns immediately with {run_id, status:"provisioning"}.
curl -sS -m 60 --fail-with-body -X POST "$RELAY/linode/provision" \
  -H "X-Relay-Secret: $RELAY_KEY" -H "X-Actor: $ACTOR" -H "Content-Type: application/json" \
  -d "$(jq -n --arg r "$ROLE" --arg id "$RUN_ID" '{role:$r, run_id:$id}')" >"$RUN_DIR/provision-start.json"

# Mark the run relay-brokered NOW so the SessionEnd hook can tear it down even if we lose the poll.
printf '%s' "$RELAY"                      >"$RUN_DIR/relay"        # relay URL for the SessionEnd hook
printf '%s' "${CLAUDE_CODE_SESSION_ID:-}" >"$RUN_DIR/session_id"   # scopes the SessionEnd hook

# 2) Poll for the result — a dropped connection is recoverable (state is on the relay).
deadline=$(( $(date +%s) + 900 ))
while :; do
  code=$(curl -sS -m 60 -o "$RUN_DIR/provision.json" -w '%{http_code}' -X POST "$RELAY/linode/provision-result" \
    -H "X-Relay-Secret: $RELAY_KEY" -H "X-Actor: $ACTOR" -H "Content-Type: application/json" \
    -d "$(jq -n --arg id "$RUN_ID" '{run_id:$id}')")
  case "$code" in
    200) echo "VM ready"; break;;
    202) echo "provisioning…";;
    502) echo "provisioning FAILED:"; jq -r '.detail // .' "$RUN_DIR/provision.json"; break;;
    *)   echo "unexpected $code:"; cat "$RUN_DIR/provision.json";;
  esac
  [ "$(date +%s)" -lt "$deadline" ] || { echo "timed out"; break; }
  sleep 15
done

# 3) Unpack what the session-side helpers (run.sh/sync.sh/extend.sh) need locally.
if jq -e .exec_token "$RUN_DIR/provision.json" >/dev/null 2>&1; then
  jq -r .ip            "$RUN_DIR/provision.json" >"$RUN_DIR/ip"
  jq -r .exec_token    "$RUN_DIR/provision.json" >"$RUN_DIR/exec_token"; chmod 600 "$RUN_DIR/exec_token"
  jq -r .exec_cert_pem "$RUN_DIR/provision.json" >"$RUN_DIR/exec_cert.pem"
else
  echo "no exec creds — tear the run down (Cleanup) before retrying"
fi
```

`role` is `test-runner` or `investigator` — a tag only, but it must be a safe
identifier (`[A-Za-z0-9._-]`, no spaces or `..`); the relay rejects anything else
with `400 bad_role`. The relay:

- Creates a Linode VM (default `g6-standard-6`, Ubuntu 24.04) with a firewall open only on 443, tagged `pmm-qa-ephemeral`.
- Waits for the exec-server to answer, then for cloud-init to finish installing Docker + Ansible and scheduling its own self-destruct timer (default 24h — see Cleanup below).
- `git clone`s `percona/pmm-qa` onto the box at `/root/pmm-qa` — `main` by default, or pass `"pmm_qa_ref":"<branch>"` in the POST body (must already be pushed; see "Never code on the Linode VM" above).

Works from the **default** proxied-HTTPS environment — no special network policy needed. Provisioning is **async**: the first call returns a `run_id`, then you poll `/linode/provision-result` until `200` (ready — creds in the body) or `502` (failed). The build runs on the relay and all state lives in its run dir, so a dropped connection is recoverable by re-polling the same `run_id` (usually 2-4 min). After this, `run.sh`/`sync.sh`/`extend.sh` are addressed exactly as before by `<run_id>` — they use the local `exec_token` + `exec_cert.pem`, never the account token. **Teardown is the exception:** it goes through the relay's `/linode/destroy` (see Cleanup), not a local `down.sh`, since destroying the VM needs the account token that no longer lives in this environment.

**Keep-alive:** for an explicit "leave it running" request, add `"ttl_hours":<N>` to the POST body **and** `touch "$RUN_DIR/keep-alive"` — the marker tells the SessionEnd hook to leave this VM up (its on-box self-destruct timer still reaps it after `ttl_hours`).

## 2. Server (always first)

```bash
export DOCKER_VERSION=...          # from FB JNKPercona comment, or perconalab/pmm-server:3-dev-latest
export WATCHTOWER_VERSION=...      # optional
export CLIENT_VERSION='...'        # client tarball URL (for step 3)
export DOCKER_ENV_VARIABLE='-e PMM_DEBUG=1 -e PMM_ENABLE_TELEMETRY=0'  # override per ticket

# Persisted to a file, not just exported -- every run.sh call is a separate
# remote process, and each command below may itself run in its own local
# shell, so an exported shell variable alone won't reliably survive to step 3/4.
RUN_DIR="terraform/linode-runner/runs/<run_id>"
ADMIN_PASSWORD="$(openssl rand -base64 18)"   # unique per run -- never reuse a fixed password across VMs
echo "$ADMIN_PASSWORD" >"$RUN_DIR/admin_password"
chmod 600 "$RUN_DIR/admin_password"

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

`-p 8443:8443`, not `443:8443` — host port 443 belongs to nginx, which forwards the plain (unprefixed) hostname here (see "Accessing the VM"). Client containers on the same `pmm-qa` docker network reach it by container hostname (`pmm-server`) regardless of the host mapping — see step 3.

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

Once ready, fetch PMM's own TLS cert over the already cert-pinned exec channel and save it locally — this lets step 4's browser scripts pin PMM's cert too instead of trusting any cert on the connection:

```bash
terraform/linode-runner/run.sh <run_id> -- "echo | openssl s_client -connect 127.0.0.1:8443 -servername pmm-server 2>/dev/null | openssl x509" \
  >"terraform/linode-runner/runs/<run_id>/pmm_cert.pem"
```

## 3. Databases (ticket-specific, after server is up)

```bash
ADMIN_PASSWORD="$(cat terraform/linode-runner/runs/<run_id>/admin_password)"

terraform/linode-runner/run.sh <run_id> -- "
  cd pmm-qa/qa-integration/pmm_qa/pmm-framework && \
  ADMIN_PASSWORD='$ADMIN_PASSWORD' CLIENT_VERSION='$CLIENT_VERSION' \
  ./pmm-framework --pmm-server-password \"\$ADMIN_PASSWORD\" \
    --client-version \"\$CLIENT_VERSION\" \
    --database <FROM_TEST_PLAN> --verbose
"
```

Pick `--database` from the ticket + [references/SETUP-INVENTORY.md](references/SETUP-INVENTORY.md), or `pmm-framework --help` on the box.

## 4. UI

Local Playwright/Chromium, not a remote "computer use" browser — see `ui-evidence`. Use the **plain** nip.io hostname, no `exec-` prefix — that prefix is reserved for the exec-server; anything else routes through nginx to PMM:

```bash
PMM_URL="https://$(cat terraform/linode-runner/runs/<run_id>/ip | tr '.' '-').nip.io" \
ADMIN_PASSWORD="$(cat terraform/linode-runner/runs/<run_id>/admin_password)" \
PMM_CERT_PATH="terraform/linode-runner/runs/<run_id>/pmm_cert.pem" \
  node .claude/scripts/pmm-ui-login.js <TICKET>
```

`PMM_CERT_PATH` pins the exact cert fetched in step 2 (via Chromium's `--ignore-certificate-errors-spki-list`, not a blanket "trust anything") instead of the script's `ignoreHTTPSErrors` fallback. Pass it to `pw-screenshot.js`/`pw-record.js` too when the URL is PMM's own — omit it for non-PMM URLs (e.g. a GitHub Actions run), which already have a real CA.

## 5. FB / nightly workflow reproduction (Investigator)

Follow `pmm-qa/.github/workflows/runner-e2e-tests-codeceptjs.yml`, `runner-e2e-tests-playwright.yml`, or `runner-integration-cli-tests.yml` for the exact steps — not Jenkins staging. If the fix under test lives on a branch, push it, then `up.sh`/`sync.sh` with `PMM_QA_REF` set to that branch — never patch it in by hand on the box.

## 6. Running longer than expected?

```bash
terraform/linode-runner/extend.sh <run_id> <more_hours>
```

Reschedules the self-destruct timer on the live instance instead of losing it mid-investigation. Ask before extending someone else's run.

## 7. Cleanup — mandatory, every path (via the relay)

Teardown holds the account token, so it too goes through the relay:

```bash
RELAY=https://139-162-176-43.ip.linodeusercontent.com
# X-Actor is your GitHub login — set ACTOR from the GitHub MCP get_me (.login) first.
# gh is a fallback only where present; fail closed on an empty actor (the relay 401s it).
command -v gh >/dev/null && ACTOR="${ACTOR:-$(gh api user --jq .login)}"
[ -n "$ACTOR" ] || { echo "ACTOR unset — set it from the GitHub MCP get_me .login" >&2; exit 1; }
# Drop the local run markers only after a confirmed destroy — otherwise the SessionEnd
# hook (and the on-box timer) can still retry teardown of an un-destroyed VM.
if curl -sS -m 120 --fail-with-body -X POST "$RELAY/linode/destroy" \
     -H "X-Relay-Secret: $RELAY_KEY" -H "X-Actor: $ACTOR" \
     -H "Content-Type: application/json" -d "$(jq -n --arg id "<run_id>" '{run_id:$id}')"; then
  rm -rf "terraform/linode-runner/runs/<run_id>"
else
  echo "destroy failed — keeping run markers so the SessionEnd hook / reaper can retry" >&2
fi
```

Call this whether the run passed, failed, or was blocked — it's the primary, immediate cleanup mechanism. The instance also self-destructs on its own after `ttl_hours` (default 24h) regardless, via an on-box systemd timer — no external reaper process, no scheduled Routine, nothing that could mistakenly delete a still-active run out from under someone. Never skip `/linode/destroy` anyway: an unterminated Linode VM keeps costing money for however long is left before its own timer fires. (For an explicit keep-alive run, skip destroy — the `keep-alive` marker and the on-box timer handle it.)

## Network policy — shared env is `Full` (tracking claude-code#82284)

The shared QA environment's network access is set to **`Full`**, not Custom — a deliberate interim choice. Org-shared environments can't be set to Custom yet ([claude-code#82284](https://github.com/anthropics/claude-code/issues/82284)), so rather than maintain one Custom copy per teammate we accept `Full` for the shared env; fine here because every VM is throwaway, short-TTL, and driven by least-privilege service credentials.

On each provisioning run, cheaply check whether that's still necessary — if #82284 is fixed we want to tighten egress back to Custom:

Check the issue state with the GitHub MCP `issue_read` tool (owner `anthropics`,
repo `claude-code`, issue `82284`) — it may 403 if that repo isn't attached to the
session, which is fine, treat as "unknown, leave as-is". (`gh api
repos/anthropics/claude-code/issues/82284 --jq .state` is a fallback only where
`gh` exists.)

If it reports `closed` (or the issue page shows it resolved), leave the user a note in your run summary — do **not** change anything yourself (the env's network level is admin-only, web-UI config):

> ℹ️ **claude-code#82284 looks resolved** — the shared QA environment can move from `Full` to **Custom** now. Allowlist: `perconadev.atlassian.net`, `api.linode.com`, `*.nip.io`, `registry.terraform.io`, relay host `139-162-176-43.ip.linodeusercontent.com` (+ "Also include default list"). An admin flips this at claude.ai/admin-settings.

If it's still `open`, say nothing — `Full` remains the intended state.

## Known limits

None specific to the VM itself — it is a real kernel with real systemd, so playbooks that need `antmelekhin/docker-systemd`-style images work normally (this is the whole reason this setup exists instead of running inside the agent's own sandbox). If a setup still fails, it is a genuine `qa-integration` bug — report it, do not fork around it here.

No special environment configuration needed — provisioning, `pmm-framework`, `pmm-admin`, log/DB checks, `pmm-encryption-rotation`, and direct browser access to PMM's UI all work from the default network policy.
