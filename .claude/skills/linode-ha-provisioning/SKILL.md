---
name: linode-ha-provisioning
description: Provision PMM in High Availability mode on a throwaway Linode LKE (Kubernetes) cluster via Helm, and verify HA behaviour (leader election, failover, shared state). Use once a change is known to be HA-impacted — see the test-scope skill to decide that first. The Linode/LKE counterpart to linode-docker-provisioning.
---

# PMM HA provisioning (Linode LKE)

Stands up a real PMM HA cluster to test HA-specific behaviour that a single container can't surface: **N `pmm-managed` replicas with one elected leader** (Raft + memberlist gossip), state externalised to shared PostgreSQL, ClickHouse, and VictoriaMetrics behind HAProxy, on Kubernetes.

This is the Kubernetes/LKE counterpart to [`linode-docker-provisioning`](../linode-docker-provisioning/SKILL.md) (the default single-VM Docker deployment). Same discipline: **throwaway, short-lived, torn down on every path** — an LKE cluster bills by the hour. Agent-neutral: Test Runner is the primary caller, Investigator can use it to reproduce an HA-specific FB/CI failure.

**Only run this when HA is actually in scope.** Whether a change needs HA testing is decided upstream, during planning, by the [`test-scope`](../test-scope/SKILL.md) skill (its `references/ha.md` holds the code-grounded criteria). Don't stand up a cluster speculatively.

## Prerequisites

The `LINODE_TOKEN` does **not** live in this environment — it lives only on the relay, exactly as for the single-VM [`linode-docker-provisioning`](../linode-docker-provisioning/SKILL.md) path. This env holds one scoped var, `RELAY_KEY`; identity is your GitHub login in `X-Actor` (`gh api user`, which the egress proxy verifies), roster-checked by the relay. The relay runs `create-lke-pmm-ha.sh` with its own token, stamps the cluster with an `expires-<epoch>` tag (so the reaper can reap it — see Teardown), and returns `{cluster_id, external_ip, url, kubeconfig_b64, passwords}`.

You still need `kubectl` (and `helm`, for chart pokes) **locally** to drive the returned kubeconfig — the cluster's API server is a public HTTPS endpoint the sandbox can reach. Install with `k8s/install_k8s_tools.sh --kubectl --helm`. No `linode-cli` or token is needed on the session side. The relay's `LINODE_TOKEN` must carry **Kubernetes (LKE): Read/Write** for provision/destroy and the reaper (nothing about Linodes/Firewalls/NodeBalancers directly — LKE's own controller creates the LoadBalancer in-cluster).

## Provision

```bash
RELAY=https://139-162-176-43.ip.linodeusercontent.com   # fixed prod relay (reserved IP)
RUN_ID=<jira-key-or-run-id>                              # e.g. PMM-14744
RUN_DIR="terraform/linode-runner/runs/$RUN_ID"           # session-side markers (same dir the SessionEnd hook scans)
mkdir -p "$RUN_DIR"
ACTOR="$(gh api user --jq .login 2>/dev/null)"

# ttl_hours optional (default 24). Overridable: node_count/node_type/region/
# k8s_version/namespace, and for FB — pmm_chart/deps_chart, pmm_set/deps_set,
# chart_version, or pmm_values_b64/deps_values_b64 (a values.yaml, base64). See "Custom charts".
curl -sS -m 1800 --fail-with-body -X POST "$RELAY/linode/provision-lke" \
  -H "X-Relay-Secret: $RELAY_KEY" -H "X-Actor: $ACTOR" -H "Content-Type: application/json" \
  -d "$(jq -n --arg id "$RUN_ID" '{run_id:$id}')" >"$RUN_DIR/provision.json"

# Unpack: kubeconfig for kubectl, cluster_id marker for teardown, session tag.
jq -r .kubeconfig_b64 "$RUN_DIR/provision.json" | base64 -d >"$RUN_DIR/kubeconfig.yaml"; chmod 600 "$RUN_DIR/kubeconfig.yaml"
jq -r .cluster_id     "$RUN_DIR/provision.json" >"$RUN_DIR/lke"          # marks this run LKE-brokered (holds cluster_id)
printf '%s' "$RELAY"                      >"$RUN_DIR/relay"              # relay URL for the SessionEnd hook
printf '%s' "${CLAUDE_CODE_SESSION_ID:-}" >"$RUN_DIR/session_id"        # scopes the SessionEnd hook
export KUBECONFIG="$PWD/$RUN_DIR/kubeconfig.yaml"
jq -r '"URL: \(.url)\nadmin password: \(.passwords.pmm_admin_password)"' "$RUN_DIR/provision.json"
```

The call blocks while the cluster + operators + PMM + HAProxy + LoadBalancer come
up (often 10–20 min; the relay allows up to 25) and returns only once the cluster
is ready. `kubectl`/`helm` then work locally against `$KUBECONFIG`. Defaults (all
overridable in the POST body): `region=us-east`, `node_type=g6-standard-4`,
`node_count=3` (Raft quorum, tolerates one node down), `k8s_version=1.33`.

**Keep-alive:** add `"ttl_hours":<N>` to the POST body **and**
`touch "$RUN_DIR/keep-alive"` — the marker keeps the SessionEnd hook from tearing
it down; the cluster's `expires-<epoch>` tag (now + N h) still lets the reaper reap it.

### Custom charts / Feature Build

Install from FB or custom Helm charts by adding fields to the POST body instead of env vars — the relay maps them to the script's `PMM_CHART`/`DEPS_CHART`/`PMM_SET`/`DEPS_SET`/`CHART_VERSION`, and `pmm_values_b64`/`deps_values_b64` (a `values.yaml` base64-encoded, written into the run dir on the relay). The `pmm-ha` chart's image keys are `image.repository` / `image.tag`:

```bash
-d "$(jq -n --arg id "$RUN_ID" --arg tag "<fb-tag>" '{
  run_id:$id,
  pmm_set:("image.repository=perconalab/pmm-server,image.tag=" + $tag)
  # or: pmm_values_b64: (<base64 of a values.yaml>), deps_values_b64: (...)
}')"
```

The exact image key depends on the chart version — read that chart's `values.yaml`, don't assume. Get the FB server image (repo + tag) from the latest JNKPercona comment on the ticket's linked `pmm-submodules` PR (`fb-tests` skill), same source single-VM runs use. A chart path (`/path/to/fb/pmm-ha`) only works if it exists **on the relay**; for FB prefer `pmm_set`/`_b64` values over a local chart path.

## Verify HA behaviour (not just "it's up")

Standing up the cluster isn't the test. Exercise what the change actually touched (see `test-scope`'s `references/ha.md`), e.g.:

- `kubectl get pods -n pmm` — replicas, operators, HAProxy all Ready.
- Leader status: PMM's HA API / `pmm_ha_*` metrics; confirm exactly one leader.
- **Leader failover** for leader-only work (backups, scheduler, checks, telemetry, cleaner, versionCache): delete the leader pod, confirm a new leader is elected and the singleton work resumes there once — not zero times, not on every replica.
- Shared state: confirm data written on one replica is visible via another (it lives in the shared PG/ClickHouse/VM, not local `/srv`).
- UI via the LoadBalancer IP (`ui-evidence`), using the admin password from the provision response (`.passwords.pmm_admin_password` in `provision.json`).

## Teardown — mandatory, every path

```bash
ACTOR="$(gh api user --jq .login 2>/dev/null)"
curl -sS -m 240 -X POST "$RELAY/linode/destroy-lke" \
  -H "X-Relay-Secret: $RELAY_KEY" -H "X-Actor: $ACTOR" -H "Content-Type: application/json" \
  -d "$(jq -n --arg id "$RUN_ID" '{run_id:$id}')"
```

Delete the cluster whether the run passed, failed, or was blocked — this is the last step, always. Unlike the single-VM path there is **no on-box self-destruct timer**; the guarantee is the **relay's TTL reaper**, which deletes any `pmm-qa-ephemeral` cluster past its `expires-<epoch>` tag (default 24h) even if this call never runs — the LKE equivalent of the VM's on-box timer. The SessionEnd hook fires the same `/linode/destroy-lke` for any run dir carrying an `lke` marker, so a normal session cleans up on its own; still call it explicitly at end of run — the reaper is the backstop, not the primary path. If you also created a box with `linode-docker-provisioning`, tear that VM down too — destroying the cluster does not touch it.
