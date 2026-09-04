---
name: linode-ha-provisioning
description: Provision PMM in High Availability mode on a throwaway Linode LKE (Kubernetes) cluster via Helm, and verify HA behaviour (leader election, failover, shared state). Use once a change is known to be HA-impacted — see the test-scope skill to decide that first. The Linode/LKE counterpart to linode-docker-provisioning.
---

# PMM HA provisioning (Linode LKE)

Stands up a real PMM HA cluster to test HA-specific behaviour that a single container can't surface: **N `pmm-managed` replicas with one elected leader** (Raft + memberlist gossip), state externalised to shared PostgreSQL, ClickHouse, and VictoriaMetrics behind HAProxy, on Kubernetes.

This is the Kubernetes/LKE counterpart to [`linode-docker-provisioning`](../linode-docker-provisioning/SKILL.md) (the default single-VM Docker deployment). Same discipline: **throwaway, short-lived, torn down on every path** — an LKE cluster bills by the hour. Agent-neutral: Test Runner is the primary caller, Investigator can use it to reproduce an HA-specific FB/CI failure.

**Only run this when HA is actually in scope.** Whether a change needs HA testing is decided upstream, during planning, by the [`test-scope`](../test-scope/SKILL.md) skill (its `references/ha.md` holds the code-grounded criteria). Don't stand up a cluster speculatively.

## Prerequisites

The `LINODE_TOKEN` does **not** live in this environment — it lives only on the relay, exactly as for the single-VM [`linode-docker-provisioning`](../linode-docker-provisioning/SKILL.md) path. This env holds one scoped var, `RELAY_KEY`; identity is your GitHub login in `X-Actor` — get it from the GitHub MCP `get_me` (`.login`) and `export ACTOR=<login>` (Routine sessions have no `gh`; `gh api user` is only a fallback where `gh` exists), roster-checked by the relay. The relay runs `create-lke-pmm-ha.sh` with its own token, stamps the cluster with an `expires-<epoch>` tag (so the reaper can reap it — see Teardown), and returns `{cluster_id, external_ip, url, kubeconfig_b64, passwords}`.

You still need `kubectl` (and `helm`, for chart pokes) **locally** to drive the returned kubeconfig — the cluster's API server is a public HTTPS endpoint the sandbox can reach. Install with `k8s/install_k8s_tools.sh --kubectl --helm`. No `linode-cli` or token is needed on the session side. The relay's `LINODE_TOKEN` must carry **Kubernetes (LKE): Read/Write** for provision/destroy and the reaper, plus **Volumes: Read/Write** and **NodeBalancers: Read/Write** — `lke cluster-delete` does *not* cascade to the CSI-provisioned volumes (`pvc-*`) or the CCM-provisioned NodeBalancer, so teardown deletes those orphans itself (see Teardown); without those two scopes they leak and bill for weeks.

## Provision

```bash
RELAY=https://139-162-176-43.ip.linodeusercontent.com   # fixed prod relay (reserved IP)
RUN_ID=<jira-key-or-run-id>                              # e.g. PMM-14744
RUN_DIR="terraform/linode-runner/runs/$RUN_ID"           # session-side markers (same dir the SessionEnd hook scans)
mkdir -p "$RUN_DIR"
# X-Actor is your GitHub login — set ACTOR from the GitHub MCP get_me (.login) first.
# gh is a fallback only where present; fail closed on an empty actor (the relay 401s it).
command -v gh >/dev/null && ACTOR="${ACTOR:-$(gh api user --jq .login)}"
[ -n "$ACTOR" ] || { echo "ACTOR unset — set it from the GitHub MCP get_me .login" >&2; exit 1; }

# ttl_hours optional (default 24). Overridable: node_count/node_type/region/
# k8s_version/namespace, and for a specific release/RC/FB — pmm_chart/deps_chart,
# chart_version (pin it — default is LATEST), pmm_set/deps_set, or
# pmm_values_b64/deps_values_b64 (a values.yaml, base64). See "Charts" below.
# 1) Kick off the build — returns immediately with {run_id, status:"provisioning"}.
#    The cluster builds server-side on the relay; this call does NOT hold open.
curl -sS -m 60 --fail-with-body -X POST "$RELAY/linode/provision-lke" \
  -H "X-Relay-Secret: $RELAY_KEY" -H "X-Actor: $ACTOR" -H "Content-Type: application/json" \
  -d "$(jq -n --arg id "$RUN_ID" '{run_id:$id}')" >"$RUN_DIR/provision-start.json"

# Mark the run LKE-brokered NOW so teardown/reaper work even if we lose the poll.
printf '%s' "$RELAY"                      >"$RUN_DIR/relay"              # relay URL for the SessionEnd hook
printf '%s' "${CLAUDE_CODE_SESSION_ID:-}" >"$RUN_DIR/session_id"        # scopes the SessionEnd hook
: >"$RUN_DIR/lke"                                                       # marks this run LKE-brokered; destroy-lke keys by run_id

# 2) Poll for the result — a dropped connection is recoverable (state is on the relay).
deadline=$(( $(date +%s) + 2400 ))
while :; do
  code=$(curl -sS -m 60 -o "$RUN_DIR/provision.json" -w '%{http_code}' -X POST "$RELAY/linode/lke-result" \
    -H "X-Relay-Secret: $RELAY_KEY" -H "X-Actor: $ACTOR" -H "Content-Type: application/json" \
    -d "$(jq -n --arg id "$RUN_ID" '{run_id:$id}')")
  case "$code" in
    200) echo "cluster ready"; break;;
    202) echo "provisioning… ($(jq -r '.phase // "?"' "$RUN_DIR/provision.json"))";;
    502) echo "provisioning FAILED:"; jq -r '.detail // .' "$RUN_DIR/provision.json"; break;;
    *)   echo "unexpected $code:"; cat "$RUN_DIR/provision.json";;
  esac
  [ "$(date +%s)" -lt "$deadline" ] || { echo "timed out waiting for cluster"; break; }
  sleep 30
done

# 3) On success, unpack kubeconfig + cluster_id marker.
if jq -e .kubeconfig_b64 "$RUN_DIR/provision.json" >/dev/null 2>&1; then
  jq -r .kubeconfig_b64 "$RUN_DIR/provision.json" | base64 -d >"$RUN_DIR/kubeconfig.yaml"; chmod 600 "$RUN_DIR/kubeconfig.yaml"
  jq -r .cluster_id     "$RUN_DIR/provision.json" >"$RUN_DIR/lke"       # holds cluster_id (teardown also works by run_id)
  export KUBECONFIG="$PWD/$RUN_DIR/kubeconfig.yaml"
  jq -r '"URL: \(.url)\nadmin password: \(.passwords.pmm_admin_password)"' "$RUN_DIR/provision.json"
else
  echo "no kubeconfig — tear the run down (step: Teardown) before retrying"
fi
```

Provisioning is **async**: the first call returns a `run_id` at once, then you poll
`/linode/lke-result` until `200` (ready — kubeconfig in the body), `502` (failed —
`detail` has the log tail), or your deadline. This survives a dropped connection:
the build runs on the relay (capped at 35 min) and all state lives in its run dir,
so re-polling the same `run_id` always returns the current state. The cluster +
operators + PMM + HAProxy + LoadBalancer usually take 10–20 min. `kubectl`/`helm`
then work locally against `$KUBECONFIG`. Defaults (all
overridable in the POST body): `region=us-east`, `node_type=g6-standard-4`,
`node_count=3` (Raft quorum, tolerates one node down); `k8s_version` defaults to the latest LKE offers (versions roll — a retired pin 400s).

**Running the `@pmm-ha` suite? Ask for `"node_count":4`.** The default 3 sizes the
cluster for exactly what the chart installs — each PMM pod requests 2 CPU and the
stack leaves ~1.3 free per node — so PMM-T2124, which scales `pmm-ha` to five pods,
leaves the new pods `Pending` forever. The fourth node takes both of them (the
chart's pod anti-affinity is preferred-only and its selector does not even match
these pods). Same reason `pmm3-ha-rosa` runs four workers.

**Keep-alive:** add `"ttl_hours":<N>` to the POST body **and**
`touch "$RUN_DIR/keep-alive"` — the marker keeps the SessionEnd hook from tearing
it down; the cluster's `expires-<epoch>` tag (now + N h) still lets the reaper reap it.

### Charts — first decide: is the chart part of what you're testing? (TWO repos)

An HA change routinely spans **two repos**, and the fix can be in either or **both**:

- **`percona/pmm`** — the server image (Go, UI, dashboards). Delivered as the PMM/FB image.
- **`percona/percona-helm-charts`** — the `pmm-ha` / `pmm-ha-dependencies` charts (env
  wiring, downward-API values, operators, templating). Delivered as a **chart**.

**Default chart: the `PMM-HA-GA` branch of `percona/percona-helm-charts`.** HA GA work
lives on that branch and is not merged or published yet, so it — not the released
`percona/pmm-ha` — is the chart PMM HA is tested against today. The relay installs the
*released* chart, so after the cluster comes up swap `PMM-HA-GA` in yourself (commands
below). Only drop this once `PMM-HA-GA` has merged and shipped in a published chart
version.

**Compare the versions before swapping — the swap is not unconditional.** The published
chart moves on its own, so the branch is not always ahead of it. Read `version` and
`appVersion` from `charts/pmm-ha/Chart.yaml` on the branch and compare them with what the
relay installed (`helm list -n pmm`):

```bash
helm list -n pmm    # installed chart version + app version

# the branch's own versions — clone it here, before deciding; the swap below reuses
# this same clone, so it is fetched once either way
CHART_BRANCH=PMM-HA-GA   # or the ticket's chart PR branch
[ -d /tmp/phc ] || git clone -b "$CHART_BRANCH" --depth 1 \
  https://github.com/percona/percona-helm-charts /tmp/phc
grep -E '^(version|appVersion):' /tmp/phc/charts/pmm-ha/Chart.yaml
```

Swap when the branch **carries the change under test**, or when it is newer. When it is
older and no chart change is under test, keep what the relay installed — swapping there
downgrades the chart *and* the PMM server out from under the run, and every result after
it describes the wrong build. Say which chart you ended up on in the report.

Before installing anything, read the ticket's linked PR(s) and check **both** repos.
When the change under test includes `percona-helm-charts` commits (a PR or branch off
`PMM-HA-GA`), that chart is **part of the changes under test**: install it instead of
`PMM-HA-GA` and report on it alongside the PMM image. Search for it:

```bash
# GitHub MCP: search_pull_requests "repo:percona/percona-helm-charts <PMM-key or feature>"
#             + list_branches (HA GA work branches off PMM-HA-GA)
```

**Never test an HA change against the released chart.** Doing so tests the wrong thing
and yields false findings (e.g. concluding "the chart never sets `PMM_HA_NAMESPACE`"
when the unmerged chart is exactly what adds it). After the relay brings the cluster
up, swap in the chart yourself against the returned `$KUBECONFIG`:

```bash
# $CHART_BRANCH from the version gate above — already cloned there, this is a no-op then
[ -d /tmp/phc ] || git clone -b "$CHART_BRANCH" --depth 1 \
  https://github.com/percona/percona-helm-charts /tmp/phc
# keys per that chart's values.yaml — read it, don't assume
helm upgrade --install pmm-ha /tmp/phc/charts/pmm-ha -n pmm --reuse-values \
  --set image.repository=perconalab/pmm-server,image.tag=<fb-tag>
kubectl rollout status statefulset/pmm-ha -n pmm --timeout=20m
# if the dependencies chart also changed: helm upgrade pmm-operators /tmp/phc/charts/pmm-ha-dependencies ...
```

### Testing the released chart — only when explicitly asked

Use this only when the ticket is specifically about a published chart version (e.g.
verifying a release); otherwise use `PMM-HA-GA` as above.

The relay installs from the **Percona Helm repo**
(`https://percona.github.io/percona-helm-charts/`): **`percona/pmm-ha`** and
**`percona/pmm-ha-dependencies`**. With no `chart_version` in the POST body it installs
the **latest published** version of each — right only when you are testing *latest*.
**Whenever you are testing a specific PMM release, RC, or FB, find and pin the matching
chart version — the image tag alone does not change the chart.** Never skip the search
and hope latest matches.

Search the repo and match `appVersion` (the PMM version a chart ships) to the version
under test:

```bash
# helm must be local: k8s/install_k8s_tools.sh --helm
helm repo add percona https://percona.github.io/percona-helm-charts/ --force-update
helm repo update percona
helm search repo percona/pmm-ha --versions              # every published pmm-ha chart version
helm search repo percona/pmm-ha-dependencies --versions
helm show chart  percona/pmm-ha --version <chart-ver>   # its appVersion == the PMM version it ships
helm show values percona/pmm-ha --version <chart-ver>   # the real image.* keys — read, don't assume
```

Pick the chart version whose `appVersion` matches the PMM version under test and pass
it as `chart_version` (the relay applies `--version` to both charts). For anything else
— and always when the chart is part of the change — don't use the released repo at all:
go back to "Charts — first decide" and install `PMM-HA-GA` or the chart PR branch.

### Feature Build — override the server image on top of the chart

Once the chart version is chosen, swap only the PMM **server image** (e.g. an FB
build) by adding fields to the POST body — the relay maps them to the script's
`PMM_CHART`/`DEPS_CHART`/`PMM_SET`/`DEPS_SET`/`CHART_VERSION` and
`pmm_values_b64`/`deps_values_b64` (a `values.yaml` base64-encoded). Overriding the
image does **not** change the chart, so still pin `chart_version` above:

```bash
-d "$(jq -n --arg id "$RUN_ID" --arg tag "<fb-tag>" --arg cv "<chart-ver>" '{
  run_id:$id,
  chart_version:$cv,
  pmm_set:("image.repository=perconalab/pmm-server,image.tag=" + $tag)
  # or: pmm_values_b64: (<base64 of a values.yaml>), deps_values_b64: (...)
}')"
```

The exact image key depends on the chart version — read it with `helm show values`
above, don't assume `image.repository`/`image.tag`. Get the FB server image (repo +
tag) from the latest JNKPercona comment on the ticket's linked `pmm-submodules` PR
(`fb-tests` skill), the same source single-VM runs use.

## Verify HA behaviour (not just "it's up")

### First: admin login — verify it, and reset Grafana's admin if it 401s

The chart you are testing is now in place, so this is the first verification to run —
everything below depends on it. The relay returns `passwords.pmm_admin_password`, but on a
fresh cluster Grafana's admin user can be out of sync with it: every API and UI login 401s
even from inside a pmm pod where `pmm-secret` puts that exact value in the env, and the
chart's own `pmm-token-init` job crash-loops on the same 401. Reset only if the check fails:

```bash
URL=$(jq -r .url "$RUN_DIR/provision.json")
# keep the password out of argv (and out of any `ps` / shell history): feed curl a
# config on stdin rather than `-u "admin:$PW"`
jq -r '"user = " + ("admin:" + .passwords.pmm_admin_password | @json)' "$RUN_DIR/provision.json" \
  | curl -ksS --config - -o /dev/null -w '%{http_code}\n' "$URL/v1/server/version"   # want 200
```

`-k` stays. The cluster serves a self-signed cert, and this session's egress proxy
terminates and re-signs TLS anyway, so the cert curl sees is the proxy's — there is
nothing stable of PMM's to pin, and `--cacert`/`--pinnedpubkey` fail here even with the
correct leaf. The trust boundary for this call is the proxy and the LKE control plane, not
the leaf cert; don't send these credentials over a path you don't already trust for
`kubectl`.

On 401, reset Grafana's admin inside a pmm pod:

```bash
# grafana-cli does NOT read the GF_DATABASE_* env the server runs on, so without explicit
# overrides the reset lands in an unused local DB and silently changes nothing.
# Prefer --password-from-stdin so the password stays out of the pod's argv; check the
# image supports it first:
#   kubectl exec -n pmm statefulset/pmm-ha -- grafana-cli admin reset-admin-password --help
kubectl exec -n pmm statefulset/pmm-ha -- bash -c 'printf %s "$PMM_ADMIN_PASSWORD" | grafana-cli \
  --homepath /usr/share/grafana --config /etc/grafana/grafana.ini \
  --configOverrides "cfg:database.type=$GF_DATABASE_TYPE cfg:database.host=$GF_DATABASE_HOST cfg:database.name=$GF_DATABASE_NAME cfg:database.user=$GF_DATABASE_USER cfg:database.password=$GF_DATABASE_PASSWORD cfg:database.ssl_mode=$GF_DATABASE_SSL_MODE" \
  admin reset-admin-password --password-from-stdin'
```

If the flag isn't supported, fall back to the positional
`admin reset-admin-password "$PMM_ADMIN_PASSWORD"` — the variables still expand inside the
pod, so nothing secret reaches the local shell, but the value does land in the pod's argv.

Confirm the variable *names* the chart actually sets before adapting this, printing names
only so no value reaches the terminal or a captured log:

```bash
kubectl exec -n pmm statefulset/pmm-ha -- env | grep -E 'GF_DATABASE|PMM_ADMIN' | sed 's/=.*//'
```

Once the reset takes, `pmm-token-init` completes on its own — don't re-run it. **A reset
changes the password the rest of the run must use:** `provision.json` still holds the old
one, and the Playwright helpers read `process.env.ADMIN_PASSWORD` (defaulting to `admin`),
so export `ADMIN_PASSWORD` to the value you reset to before any UI test or `pmm-ui-login.js`
run — otherwise the suite 401s in a way that looks like the bug you're chasing.

Standing up the cluster isn't the test. Exercise what the change actually touched (see `test-scope`'s `references/ha.md`), e.g.:

- `kubectl get pods -n pmm` — replicas, operators, HAProxy all Ready.
- Leader status: PMM's HA API / `pmm_ha_*` metrics; confirm exactly one leader.
- **Leader failover** for leader-only work (backups, scheduler, checks, telemetry, cleaner, versionCache): delete the leader pod, confirm a new leader is elected and the singleton work resumes there once — not zero times, not on every replica.
- Shared state: confirm data written on one replica is visible via another (it lives in the shared PG/ClickHouse/VM, not local `/srv`).
- UI evidence (`ui-evidence` → "HA / LKE variant"): reach PMM by the hostname `.url` from `provision.json` (**not** the raw LB IP — the egress proxy refuses raw-IP HTTPS), log in with `PMM_UI_INSECURE=1` (self-signed cert) and `.passwords.pmm_admin_password`, and pass `PW_SCROLL=1` for the tall HA dashboards. Use the existing `pmm-ui-login.js` + `pw-screenshot.js` helpers — don't write a bespoke capture script.

### Adding a remote database service

An HA cluster has no PMM Client of its own, so a monitored database is added remotely
through `POST /v1/management/services`. Two things about that payload are not guessable:

- **`pmm_agent_id` is required.** Without it the add fails with `invalid AddMySQLServiceParams.PmmAgentId: value length must be at least 1 runes`. Take one from `/v1/inventory/agents` — the `pmm_agent` on a pmm-server node does the work.
- **Leave `metrics_mode` at its default.** Push is rejected outright (`push metrics mode is not allowed for exporters running on pmm-server`), and pull is the right mode anyway: the exporter runs on a pmm-server node, which VictoriaMetrics already scrapes.

A new service's series and QAN rows land a couple of scrape intervals after the add, so
an empty query right after it means nothing — hold it to the freshness window
[`verification-depth`](../verification-depth/SKILL.md) requires before calling a metric
missing.

## Teardown — mandatory, every path

```bash
# X-Actor is your GitHub login — set ACTOR from the GitHub MCP get_me (.login) first.
# gh is a fallback only where present; fail closed on an empty actor (the relay 401s it).
command -v gh >/dev/null && ACTOR="${ACTOR:-$(gh api user --jq .login)}"
[ -n "$ACTOR" ] || { echo "ACTOR unset — set it from the GitHub MCP get_me .login" >&2; exit 1; }
curl -sS -m 240 --fail-with-body -X POST "$RELAY/linode/destroy-lke" \
  -H "X-Relay-Secret: $RELAY_KEY" -H "X-Actor: $ACTOR" -H "Content-Type: application/json" \
  -d "$(jq -n --arg id "$RUN_ID" '{run_id:$id}')"
```

Delete the cluster whether the run passed, failed, or was blocked — this is the last step, always. Unlike the single-VM path there is **no on-box self-destruct timer**; the guarantee is the **relay's TTL reaper**, which deletes any `pmm-qa-ephemeral` cluster past its `expires-<epoch>` tag (default 24h) even if this call never runs — the LKE equivalent of the VM's on-box timer. The SessionEnd hook fires the same `/linode/destroy-lke` for any run dir carrying an `lke` marker, so a normal session cleans up on its own; still call it explicitly at end of run — the reaper is the backstop, not the primary path. If you also created a box with `linode-docker-provisioning`, tear that VM down too — destroying the cluster does not touch it. Both teardown and the reaper now delete the cluster's unique account-level tags (`expires-<epoch>`, `pmm-qa-run:<id>`); Linode leaves those behind otherwise, so they pile up. Sweep leftovers on the relay with `LINODE_TOKEN=… terraform/linode-runner/prune-tags.sh --dry-run` (then without `--dry-run`). The **relay reaper** also deletes the orphaned Block Storage volumes and NodeBalancer that `cluster-delete` leaves behind — the biggest HA cost leak — via `.claude/skills/linode-ha-provisioning/scripts/prune-lke-orphans.sh` (`--dry-run` to preview). It deletes by **positive attribution**. **Volumes**: `create-lke` recreates the cluster's default StorageClass (`linode-block-storage-retain`) with `linodebs.csi.linode.com/volumeTags: pmm-qa-ephemeral,pmm-qa-run:<id>`, so the CSI driver stamps the run tag on **every** volume at creation — attached or not, at provision or later. (The provision EXIT-trap and the pre-delete `tag-lke-resources.sh` in `destroy-lke`/reaper stay as a backstop for the window before the SC applies.) The sweep removes a volume only when its run has **no live cluster**. **NodeBalancers**: attributed by their immutable `lke<clusterid>-` label — the Linode CCM reconciles a NodeBalancer's tags back to its defaults, so a `pmm-qa-run` tag does **not** survive on it and cannot be used; the sweep removes one only when its `lke<id>` cluster no longer exists. A live cluster's resources (volumes unattached during provisioning/failover) and other owners' `pvc-*` volumes are never touched. `destroy-lke` does **not** sweep (cluster-delete is async — it would only see other runs' resources); the reaper owns it.
