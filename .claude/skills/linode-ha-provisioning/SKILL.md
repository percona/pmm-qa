---
name: linode-ha-provisioning
description: Decide whether a PMM change needs HA testing, and provision PMM in High Availability mode on a throwaway Linode LKE (Kubernetes) cluster via Helm. Use when a Jira ticket flags HA, or a diff touches leader-elected services, shared/externalised state, VictoriaMetrics scraping, Grafana clustering, or the pmm-ha Helm charts/operators.
---

# PMM HA provisioning (Linode LKE)

PMM's normal single-container deployment can't surface HA bugs: HA runs **N `pmm-managed` replicas with one elected leader** (Raft + memberlist gossip), state externalised to shared PostgreSQL, ClickHouse, and VictoriaMetrics behind HAProxy, all on Kubernetes. This skill decides when that matters and stands up a real HA cluster to test it.

This is the Kubernetes/LKE counterpart to [`linode-provisioning`](../linode-provisioning/SKILL.md) (single Docker VM). Same rules apply: **throwaway, short-lived, cleaned up on every path** — an LKE cluster bills by the hour. Agent-neutral: Test Runner is the primary caller, but Investigator can use it to reproduce an HA-specific FB/CI failure.

## 1. First decide if HA is even in scope

Read [references/ha-impact.md](references/ha-impact.md) and answer its two questions (ticket flags HA? diff touches the HA blast radius?). If **neither**, skip this skill — do the normal single-server run and don't create a cluster. Only continue below when HA is genuinely impacted.

## 2. Prerequisites

On the box (a Linode VM from `linode-provisioning`, or any Docker/Linux host):

- `linode-cli`, `jq`, `kubectl`, `helm`, `base64`, `openssl`. Install kubectl+helm with `k8s/install_k8s_tools.sh --kubectl --helm`; `linode-cli` via `pip install linode-cli`.
- `export LINODE_TOKEN=...` (already in this environment's secrets — never print it or write it to a file). The script reads it as `LINODE_CLI_TOKEN`.

## 3. Provision

```bash
RUN_ID="<jira-key-or-run-id>" \
  .claude/skills/linode-ha-provisioning/scripts/create-lke-pmm-ha.sh
```

One script: creates the LKE cluster, polls real readiness (no blind sleeps), installs the operators (`pmm-ha-dependencies`) and PMM (`pmm-ha`) via Helm, waits for HAProxy, exposes a LoadBalancer, and writes everything to a run dir (`/tmp/pmm-ha/<RUN_ID>/`): `kubeconfig.yaml`, `cluster_id`, and `summary.env` (URL + all generated passwords, mode `600`). It prints the URL and the teardown command on success.

Defaults (all overridable by env var): `REGION=us-east`, `NODE_TYPE=g6-standard-4`, `NODE_COUNT=3` (Raft quorum, tolerates one node down — not the prototype's 7), `K8S_VERSION=1.33`, `CLUSTER_LABEL=pmm-ha-<RUN_ID>`.

### Custom charts / Feature Build

To install from FB or custom Helm charts instead of the released Percona ones, override the chart source and image:

```bash
RUN_ID=PMM-14744 \
PMM_CHART=/path/to/fb/pmm-ha \                    # or a custom repo chart
DEPS_CHART=/path/to/fb/pmm-ha-dependencies \
PMM_SET="image.repository=perconalab/pmm-server,image.tag=<fb-tag>" \
  .claude/skills/linode-ha-provisioning/scripts/create-lke-pmm-ha.sh
```

The exact image key (`PMM_SET` / `DEPS_SET`, or a values file via `PMM_VALUES` / `DEPS_VALUES`) depends on the chart version — read that chart's `values.yaml`, don't assume. Get the FB server image from the latest JNKPercona comment on the ticket's linked `pmm-submodules` PR (`fb-tests` skill), the same source used for single-VM runs.

## 4. Verify HA behaviour (not just "it's up")

Standing up the cluster isn't the test. Exercise what the change actually touched (see `ha-impact.md`), e.g.:

- `kubectl get pods -n pmm` — replicas, operators, HAProxy all Ready.
- Leader status: PMM's HA API / `pmm_ha_*` metrics; confirm exactly one leader.
- **Leader failover** for leader-only work (backups, scheduler, checks, telemetry, cleaner, versionCache): delete the leader pod, confirm a new leader is elected and the singleton work resumes there once — not zero times, not on every replica.
- Shared state: confirm data written on one replica is visible via another (it lives in the shared PG/ClickHouse/VM, not local `/srv`).
- UI via the LoadBalancer IP (`ui-evidence`), using `summary.env` for the admin password.

## 5. Teardown — mandatory, every path

```bash
RUN_ID="<run-id>" .claude/skills/linode-ha-provisioning/scripts/destroy-lke.sh
# or: linode-cli lke cluster-delete "$(cat /tmp/pmm-ha/<RUN_ID>/cluster_id)"
```

Delete the cluster whether the run passed, failed, or was blocked — this is the last step, always. Unlike the single-VM path there is **no on-box self-destruct timer** here: nothing cleans an LKE cluster up for you, so skipping teardown leaks a multi-node cluster + LoadBalancer that bills until someone notices. If you also created the box with `linode-provisioning`, `down.sh` that VM too — it does not delete the cluster.
