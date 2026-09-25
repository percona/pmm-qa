---
name: linode-docker-provisioning
description: Provision PMM Server and monitored databases as single-server Docker on a throwaway Linode VM, using Terraform and the unmodified qa-integration bash pmm-framework. This is the default PMM deployment for QA — use it for setting up PMM for manual QA or reproducing an FB test environment, unless test-cases scope selects HA.
---

# PMM provisioning (Linode, single-server Docker)

This is the **default** deployment for PMM QA: one PMM Server container on one Linode VM. For HA (Kubernetes / multiple replicas) use [`linode-ha-provisioning`](../linode-ha-provisioning/SKILL.md) instead; `test-cases`' scope guidance decides which deployment a change needs.

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

### Calling `run.sh`

- **Absolute path, always** — `/workspace/pmm-qa/terraform/linode-runner/run.sh`. The examples below are repo-relative for readability, but any compound command that writes a script somewhere else first leaves the working directory outside the repo, and the call dies with `No such file or directory`. The rule covers every **local file read into the command** as well (`admin_password`, `ip`, `pmm_cert.pem`): `ADMIN_PASSWORD="$(cat terraform/…/admin_password)"` against a reset working directory does not error — it interpolates *empty*, and the remote suite runs a full scenario before failing on "Invalid username or password".
- **Ship anything non-trivial as a file, not as an inline string.** Each of the three shell layers (local, `run.sh`'s `bash -c`, any `docker exec … sh -c`) strips one level of quoting, and the mangled command can still exit 0 — a `sed -i -E` carrying a URL regex rewrote a container's apt sources into garbage that only surfaced on the next `apt-get update`. Anything with a loop, a regex, a `$`, or more than one level of quoting goes over as `base64 -w0` locally → decode on the box → invoke the file, and reaches a container on stdin (`docker exec -i <c> sh -s <args> < /root/s.sh`).
- **One `run.sh` in flight per `run_id`.** A second exec call issued while a poll loop is still running dies with `curl: (52) Empty reply from server` or `(56) Recv failure`, which reads as a dead box but is exec-server contention — the detached remote job is unaffected and its log keeps growing. Let the poll reach its sentinel, or kill it, before issuing another call.
- **Keep an in-command `sleep` under ~240s, and chunk the polling.** The 600s exec-server cap is not the usable budget: on a loaded box (load ~15 on 6 vCPUs) `sleep 480`/`sleep 540` polls both died with "Empty reply from server" while `sleep 240` returned normally. One *Bash tool call* is bounded the same way, so a poll loop written as one long `for` loop is moved to the background at 600s and its later polls are lost — split polling across several calls of roughly five polls each.
- **The exec channel provides no `HOME`** (`run.sh <run_id> -- "echo HOME=$HOME"` prints empty). Start every script that runs on the box with `export HOME=/root`, including inside a detached one — the export does not carry over from the `run.sh` invocation. Without it `minikube start` wrote its kubeconfig and certs under the CWD, and every later `kubectl`/`helm` call failed on a missing `ca.crt`.
- **Poll a sentinel, never `pgrep -f`.** End a detached script with a sentinel line (`echo DONE_MARKER=$?` appended to its log) and poll the log for it. `pgrep -f <script>` reports RUNNING forever — the pattern matches the exec-server's own wrapper carrying the poll — which burned two full 10-minute waits on a job that had already exited 0. The same self-match makes `pkill -9 -f <pattern>` kill the shell carrying it, so the rest of that compound command never runs: target a pidfile or an exact program path, and confirm a launch or a kill by the state it changed (a log file growing, containers gone), never by a process count on that pattern.

**`run.sh` cannot return a large payload.** It hands the exec-server's whole JSON response
to a local `python3` as a single argv, and Linux caps one argument at `MAX_ARG_STRLEN`
(128 KiB), so a big remote *output* — not a long command — aborts the call with
`Argument list too long` and you see none of it. Anything that could be large (a full API
dump, a log file, `docker inspect` over everything) gets summarised **on the box** so only
a few lines come back.

When you need the bytes themselves, `tar czf - <paths> | base64 -w0` is only safe under a
budget: base64 inflates by 4/3 and the JSON wrapper adds more, so keep the *compressed*
archive **≤ 64 KiB**. Compression is no guarantee — already-compressed logs, images and
binaries barely shrink — so measure on the box before shipping, and chunk when it's over:

```bash
run.sh <run_id> -- "tar czf /tmp/o.tgz <paths>; stat -c%s /tmp/o.tgz"

# ≤ 64 KiB — one call:
run.sh <run_id> -- "base64 -w0 /tmp/o.tgz" | base64 -d > out.tgz

# larger — split on the box, one call per chunk (49152 is a multiple of 3, so no
# '=' padding lands mid-stream and the concatenated base64 decodes as one archive):
run.sh <run_id> -- "split -b 49152 -d /tmp/o.tgz /tmp/o.part-; ls /tmp/o.part-*"
for part in <the listed parts, in order>; do
  run.sh <run_id> -- "base64 -w0 $part"
done | base64 -d > out.tgz
```

Past a few hundred KiB, stop fetching and summarise on the box instead — the chunk loop is
one round trip each and is not a bulk transfer channel.

### Anything longer than ~10 minutes runs detached

The cap is the **exec-server's own 600s command timeout** — `run.sh:61` sends only `{"cmd": …}`, never a `timeout`, so the server falls back to its default (`cloud-init.yaml.tftpl:115`, `timeout = body.get("timeout", 600)`, fed to `subprocess.run`). It kills its direct `bash -c` child at 600s while any grandchild survives holding the captured stdout pipe, and `run.sh`'s own `curl -m 620` then aborts with "failed to reach exec-server" — the symptom you see, twenty seconds after the cause. A longer client timeout therefore buys nothing, and the remote process keeps going regardless. A second run then shares the PMM Server with that orphan and the two suites' setup hooks destroy each other's fixtures — a worthless result from both. So launch a long test suite or playbook detached and poll it:

Write the work to a **script file** on the box and launch it with its file descriptors detached — `nohup … &` is not enough, because the grandchild still holds the exec-server's captured stdout pipe, so the server never sees EOF and the call hangs until the harness backgrounds it (the setup itself runs fine, which is what makes this confusing). A shell redirect written on the same line as a `&` launch can also leave no log file at all:

```bash
# 1. ship the script (see "Ship anything non-trivial as a file" above), then:
terraform/linode-runner/run.sh <run_id> -- "
  : > /root/<name>.log
  setsid bash -c 'export HOME=/root; /root/<name>.sh; echo DONE_MARKER=\$? >>/root/<name>.log' \
    >>/root/<name>.log 2>&1 </dev/null &
  echo launched
"
# 2. poll the marker from a separate call — never the wrapper's own exit code,
#    which reports the round trip and not the job.
terraform/linode-runner/run.sh <run_id> -- "tail -3 /root/<name>.log; grep -c DONE_MARKER /root/<name>.log"
```

A sentinel of `DONE_MARKER=130` — or any `128+N` — means the detach did not hold and the exec-server's teardown reached the job: relaunch it detached rather than investigating the command. `nohup … &` can look fine on a short `docker pull` and only fail past the first round trip, so use the `setsid` form for everything long.

Tee a long wait's progress to the scratchpad as well as the box (`… |& tee -a "$SCRATCH/pmm-framework.log"`): a container restart leaves a harness background task's output as nothing but `[killed]`, while scratchpad files survive — check that log before concluding anything about how far a setup got, and before re-provisioning. A `codeceptjs` run whose value *is* its measurements needs `--verbose`, or the `I.say` lines never appear and the whole detached run has to be repeated.

Before starting a new run, check for and kill any orphan a timed-out attempt left behind. Kill by the PID you printed, or with a self-excluding pattern (`pkill -f 'codecept[j]s'`): a plain `pkill -f codeceptjs` also matches the exec-server's own `bash -c "… codeceptjs …"` wrapper carrying the pkill, so it kills the calling remote shell (exit 241) and leaves the orphan running.

Judge a detached run's progress from side effects — screenshot/artifact mtimes, containers, DB rows. Its stdout is a file rather than a TTY, so it flushes in blocks: a tail can sit many minutes behind and read as hung. Read the log itself **on the box** (`grep`, `tail -n`, a summary command), never by returning the whole file: a long suite's log is far past the payload cap above, so fetching it whole aborts the call with `Argument list too long` and returns nothing at all. Use the chunked base64 fetch only for the specific part you need.

## Pick a run_id

Something unique and traceable: the Jira key (`PMM-15196`) for Test Runner, or for Investigator — `heal-<submodules-pr>` when investigating an FB Tests red, `nightly-<workflow>-<date>` when investigating its own scheduled CI. Reused as the Linode instance label/tags, and as the key the self-destruct timer uses to find its own instance.

Carry the failing workflow's **GitHub run number** in the id (`nightly-e2e-run337`), not only a date: one night's failures fire the Investigator Routine several times, and a date-only id collides between sibling sessions.

Those forms repeat across investigations of the same PR, so provisioning can come back `502` with `run_id '<id>' already has a state file`, or `409 {"status":"provisioning","hint":"already running — poll /linode/provision-result"}`. Both mean the id is **claimed**; the 409's hint is wrong for this purpose — polling it hands back a box another session is actively using, and recreating `pmm-server` there invalidates both reproductions. Treat either code the same way: pick a distinct suffix (`heal-<pr>-<test>`) and report the orphaned state in your run summary — never destroy it to free the name. If you are ever handed a box for an id you did not just create, `ls /root` and `docker ps -a` before touching anything: scripts and containers this session never made mean it belongs to someone else.

## 1. Provision the VM (via the relay)

The `LINODE_TOKEN` no longer lives in this environment — it lives only on the
relay. This env holds a **single** scoped var, `RELAY_KEY`. The relay's URL is a
fixed public hostname (the reserved-IP box), so it's hardcoded, not an env var.
The relay runs `up.sh` with its own token, keeps the Terraform state, and
returns only *this run's* `{ip, exec_token, exec_cert_pem}` — everything
`run.sh` needs to reach the box. The account token never enters this
environment.

Use the shared `relay` skill for broker identity and transport. Read its Linode
reference, resolve `ACTOR` from GitHub MCP `get_me`, and define its `R` and
`R_STATUS` curl helpers before the block below.

```bash
RELAY=https://139-162-176-43.ip.linodeusercontent.com   # fixed prod relay (reserved IP)
RUN_ID=<run_id>                       # e.g. PMM-15196 (see "Pick a run_id")
ROLE=<role>                           # test-runner or investigator (safe id: [A-Za-z0-9._-], tag only)
RUN_DIR="terraform/linode-runner/runs/$RUN_ID"
mkdir -p "$RUN_DIR"
# ttl_hours + pmm_qa_ref are optional; add keep-alive handling below.
# 1) Kick off the build — returns immediately with {run_id, status:"provisioning"}.
R linode provision "$(jq -n --arg r "$ROLE" --arg id "$RUN_ID" '{role:$r, run_id:$id}')" \
  >"$RUN_DIR/provision-start.json"

# Mark the run relay-brokered NOW so the SessionEnd hook can tear it down even if we lose the poll.
printf '%s' "$RELAY"                      >"$RUN_DIR/relay"        # relay URL for the SessionEnd hook
printf '%s' "${CLAUDE_CODE_SESSION_ID:-}" >"$RUN_DIR/session_id"   # scopes the SessionEnd hook

# 2) Poll for the result — a dropped connection is recoverable (state is on the relay).
deadline=$(( $(date +%s) + 900 ))
while :; do
  code=$(R_STATUS "$RUN_DIR/provision.json" linode provision-result \
    "$(jq -n --arg id "$RUN_ID" '{run_id:$id}')")
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

**`GF_SECURITY_ADMIN_PASSWORD` does not set the password on a PMM image** — Grafana applies it only when it *creates* the admin user, and the image ships that user pre-created (its `user` row is dated the image build, `updated` equal to `created`), so a fresh `/srv` volume doesn't help either. Keep the env var, but set the password for real once readyz has passed:

```bash
terraform/linode-runner/run.sh <run_id> -- "docker exec pmm-server change-admin-password '$ADMIN_PASSWORD'"
```

(`/usr/local/sbin/change-admin-password` wraps `grafana cli admin reset-admin-password`.) Never pipe it through `tail`/`head` — its "Admin password changed successfully" line is the only confirmation the change landed. When you are **reproducing a pipeline**, use the credential that pipeline sets (the CI jobs use `admin`) rather than generating one; a generated password against a released image that rejects it costs a round of failed registrations and trips the lockout below.

Verify the credentials **once** rather than probing: repeated failed logins trip Grafana's brute-force lockout, which then rejects even the correct password for about five minutes. The lockout is **time-based and self-clearing**, so the recovery is to stop issuing auth requests entirely for ~5 minutes and then check once — not to re-reset the password (which appears to succeed and changes nothing observable) and not to rebuild the server. While it is active every later auth probe is uninformative, so treat evidence gathered during one as void.

**Recreating `pmm-server` on the same `pmm-data` volume: `docker stop` before `docker rm`.** A `docker rm -f` leaves `/srv/postgres18/postmaster.pid` naming a PID the next container reuses, PostgreSQL then fails every retry with `FATAL: lock file "postmaster.pid" already exists`, and readyz serves an nginx 500 with nothing in the pmm-managed log. Recovery on a box already in that state: `rm /srv/postgres18/postmaster.pid` then `supervisorctl start postgresql`.

Once ready, fetch PMM's own TLS cert over the already cert-pinned exec channel and save it locally — this lets step 4's browser scripts pin PMM's cert too instead of trusting any cert on the connection:

```bash
terraform/linode-runner/run.sh <run_id> -- "echo | openssl s_client -connect 127.0.0.1:8443 -servername pmm-server 2>/dev/null | openssl x509" \
  >"terraform/linode-runner/runs/<run_id>/pmm_cert.pem"
```

## 3. Databases (ticket-specific, after server is up)

```bash
ADMIN_PASSWORD="$(cat terraform/linode-runner/runs/<run_id>/admin_password)"

terraform/linode-runner/run.sh <run_id> -- "
  export HOME=/root
  cd pmm-qa/qa-integration/pmm_qa/pmm-framework && \
  ./pmm-framework --pmm-server-password '$ADMIN_PASSWORD' \
    --client-version '$CLIENT_VERSION' \
    --database <FROM_TEST_PLAN> --verbose
"
```

The values are interpolated **here**, not dereferenced on the box: `VAR=x cmd --flag "$VAR"` is one simple command, so the argument expands before the assignment takes effect and the flag arrives empty. That form silently ran the framework as `--pmm-server-password  --client-version latest-tarball` and the whole setup had to be repeated. Confirm the arguments in the **same** remote command — `run.sh` blocks until the command finishes, so a later `pgrep` finds nothing on a run that already exited:

```bash
terraform/linode-runner/run.sh <run_id> -- "
  export HOME=/root
  cd pmm-qa/qa-integration/pmm_qa/pmm-framework && \
  set -x && ./pmm-framework --pmm-server-password '$ADMIN_PASSWORD' … --verbose
"
```

`set -x` echoes the resolved argv (password included, so keep that output out of anything shared) before the framework runs.

The password reaches the box inside the command string, which the exec-server runs through `bash -c`, so it is visible in the remote process arguments for the life of the call. That is inherent to `run.sh`'s single-string interface; it is acceptable here only because the VM is single-tenant and throwaway and the password is generated per run (step 2), never reused. Don't extend the pattern to a credential that outlives the run.

Pick `--database` from the ticket + [references/SETUP-INVENTORY.md](references/SETUP-INVENTORY.md), or `pmm-framework --help` on the box.

The server address has to be reachable **from inside the client container**: use `--pmm-server-ip pmm-server` (the shared `pmm-qa` network hostname) or the VM's own IP. `127.0.0.1` reaches it only from host-networked setups — `pdpgsql` registered fine while `haproxy` and `pgsql` failed at "Install pmm3-client", and the framework still exited after the other setup reported OK, so the failure is easy to miss.

**Checking what actually registered.** `/v1/inventory/{nodes,services,agents}` group by type, so a flat `jq -r '.nodes[]?'` prints nothing on a fully registered box and reads as "nothing registered":

```bash
curl -ksS -u "admin:$ADMIN_PASSWORD" https://127.0.0.1:8443/v1/inventory/agents \
  | jq -r 'to_entries[] | .key as $t | (.value[]? | "\($t) \(.agent_id) \(.connected)")'
```

The pmm-agent connectivity field there is `connected`; the `is_connected` the codeceptjs inventory tests read comes from `GET /v1/management/services` instead. `pmm-admin` lives at `/usr/sbin/pmm-admin` in the QA database containers, so probe with `command -v pmm-admin` rather than a fixed path, and note that `pmm-admin unregister --force` without `--node-name` targets the agent's own registered node (from its `NodeID`), which is often not the container hostname.

**Replaying a CI cleanup step has a different blast radius here.** A workflow's `on_retry_command` of `docker rm -f $(docker ps -a -q)` is safe on a runner whose PMM Server is remote and destroys this box's `pmm-server` and its `pmm-data` volume. Scope such a replay to the client containers and say so in the evidence:

```bash
docker ps -q | grep -v "$(docker inspect -f '{{.Id}}' pmm-server | cut -c1-12)" | xargs -r docker rm -f
```

**A comparison run must prove which code each arm ran.** `git fetch origin <branch>` creates no remote-tracking ref, so a following `git checkout origin/<branch>` fails with `pathspec … did not match` mid-log and that arm silently runs baseline code for a full run. Use `git fetch origin <branch> && git checkout FETCH_HEAD`, and have each arm print its resolved commit sha plus a `grep -c` of the changed symbol before it starts — a checkout error scrolls past in a long detached log, and an arm running the wrong code yields a confidently wrong result.

## 4. UI

Local Playwright/Chromium, not a remote "computer use" browser — see `ui-evidence`. Use the **plain** nip.io hostname, no `exec-` prefix — that prefix is reserved for the exec-server; anything else routes through nginx to PMM:

```bash
PMM_URL="https://$(cat terraform/linode-runner/runs/<run_id>/ip | tr '.' '-').nip.io" \
ADMIN_PASSWORD="$(cat terraform/linode-runner/runs/<run_id>/admin_password)" \
PMM_CERT_PATH="terraform/linode-runner/runs/<run_id>/pmm_cert.pem" \
  node .claude/scripts/pmm-ui-login.js <TICKET>
```

`PMM_CERT_PATH` pins the exact cert fetched in step 2 (via Chromium's `--ignore-certificate-errors-spki-list`, not a blanket "trust anything") instead of the script's `ignoreHTTPSErrors` fallback. Pass it to `pw-screenshot.js`/`pw-record.js` too when the URL is PMM's own — omit it for non-PMM URLs (e.g. a GitHub Actions run), which already have a real CA.

**Behind the egress proxy that pin can fail on this path too.** Measured on a provisioned single-server Docker run: `pmm-ui-login.js` with the step 2 cert failed at `net::ERR_CERT_AUTHORITY_INVALID`, and `openssl s_client` against the run's host on 443 returned `subject=CN = *.nip.io`, `issuer=O = Anthropic, CN = Egress Gateway SDS Issuing CA (production)` — the gateway's certificate, not PMM's, so the leaf pin had nothing to match. The trust boundary from a proxied session is the proxy plus the cert-pinned exec channel; `PMM_CERT_PATH` bites end-to-end only on a direct, unproxied path.

Check the CA bundle first: `.claude/scripts/lib/proxy.js` pins whatever interception CAs it finds in `$CCR_CA_BUNDLE` (default `/root/.ccr/ca-bundle.crt`) into the same flag as your PMM pin, so a gateway issuer missing there is the real gap and adding it keeps verification on. `PMM_UI_INSECURE=1` is the fallback when it can't be — it disables verification for the whole browser context, and this is the path that sends the admin credential, which is why `pmm-ui-login.js` prints an HA/LKE-only warning for it. Taking that route is a deliberate exception: note it in the evidence rather than treating it as the default. What makes it tolerable is that the credential at risk is this run's own — step 2 generates it per VM and it dies with the box — so never take this path with a shared or long-lived password.

Running the repo's **own Playwright suite** (`e2e_tests/`) against the VM from this
environment needs the proxy set explicitly. The symptom: every request fails with
`503 upstream connect error` against a URL that `curl` fetches with 200. That 503 is the
egress proxy's own response, so the traffic did reach it — this is a proxy *path* problem,
not a broken PMM, and not the suite bypassing the proxy altogether. The fix is to make the
suite go through it explicitly: extend `playwright.config.ts` in a scratch config with
`use.proxy.server` set to this session's `$HTTPS_PROXY`, run
`npx playwright test --config <scratch>`, and keep that file out of the commit — CI runners
have direct egress and the override would break them.

Two details decide whether that scratch config does anything at all. The base config's
`projects[0].use` wins over a top-level `use`, so map the overrides over `base.projects` as
well as the top level; and `testDir: './tests'` resolves relative to the scratch file, so it
must be made absolute or Playwright reports "No tests found". Pin
`executablePath: '/opt/pw-browsers/chromium'` in the same override — Playwright's
bundled-browser resolution points at a revision that is not installed and fails with
`Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-<rev>`.

That session-side recipe only covers suites that drive the UI over HTTP. **Anything touching Docker, `pmm-admin`, or the local filesystem must run on the VM, the way the workflow runs it** — install Node and the suite on the box and run the same `npx playwright test --grep`; `e2e_tests` needs only `PMM_UI_URL` and `ADMIN_PASSWORD`. Tests calling `docker exec <container> pmm-admin annotate` cannot work from this session at all (Docker runs only on the VM), and a session-side run of them reached the login redirect and never the dashboard. An ad-hoc spec must also sit under the config's `testDir` (`./tests`), or Playwright reports "No tests found".

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
# Drop the local run markers only after a confirmed destroy — otherwise the SessionEnd
# hook (and the on-box timer) can still retry teardown of an un-destroyed VM.
if R linode destroy "$(jq -n --arg id "<run_id>" '{run_id:$id}')"; then
  rm -rf "terraform/linode-runner/runs/<run_id>"
else
  echo "destroy failed — keeping run markers so the SessionEnd hook / reaper can retry" >&2
fi
```

Call this whether the run passed, failed, or was blocked — it's the primary, immediate cleanup mechanism. The instance also self-destructs on its own after `ttl_hours` (default 24h) regardless, via an on-box systemd timer — no external reaper process, no scheduled Routine, nothing that could mistakenly delete a still-active run out from under someone. Never skip `/linode/destroy` anyway: an unterminated Linode VM keeps costing money for however long is left before its own timer fires. (For an explicit keep-alive run, skip destroy — the `keep-alive` marker and the on-box timer handle it.) Teardown also deletes the run's unique account-level tag (Linode leaves those behind on destroy, so they otherwise pile up); to sweep any leftovers by hand on the relay, `LINODE_TOKEN=… terraform/linode-runner/prune-tags.sh --dry-run` lists every matching orphan tag (`pmm-qa*` / `expires-`), then run it without `--dry-run` to delete them.

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
