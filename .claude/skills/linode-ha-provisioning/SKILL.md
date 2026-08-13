---
name: linode-ha-provisioning
description: Provision PMM in High Availability mode on a throwaway Linode LKE (Kubernetes) cluster via Helm, and verify HA behaviour (leader election, failover, shared state). Use once a change is known to be HA-impacted — see the test-scope skill to decide that first. The Linode/LKE counterpart to linode-docker-provisioning.
---

# PMM HA provisioning (Linode LKE)

Stands up a real PMM HA cluster to test HA-specific behaviour that a single container can't surface: **N `pmm-managed` replicas with one elected leader** (Raft + memberlist gossip), state externalised to shared PostgreSQL, ClickHouse, and VictoriaMetrics behind HAProxy, on Kubernetes.

This is the Kubernetes/LKE counterpart to [`linode-docker-provisioning`](../linode-docker-provisioning/SKILL.md) (the default single-VM Docker deployment). Same discipline: **throwaway, short-lived, torn down on every path** — an LKE cluster bills by the hour. Agent-neutral: Test Runner is the primary caller, Investigator can use it to reproduce an HA-specific FB/CI failure.

**Only run this when HA is actually in scope.** Whether a change needs HA testing is decided upstream, during planning, by the [`test-scope`](../test-scope/SKILL.md) skill (its `references/ha.md` holds the code-grounded criteria). Don't stand up a cluster speculatively.

## Prerequisites

On the box (a Linode VM from `linode-docker-provisioning`, or any Docker/Linux host):

- `linode-cli`, `jq`, `kubectl`, `helm`, `base64`, `openssl`. Install kubectl+helm with `k8s/install_k8s_tools.sh --kubectl --helm`; `linode-cli` via `pip install linode-cli`.
- A Linode API token with **Kubernetes (LKE): Read/Write** — the only scope the script's `linode-cli lke ...` calls need (nothing about Linodes, Firewalls, or NodeBalancers directly: the LoadBalancer is created in-cluster by LKE's own controller). Provide it as `LINODE_TOKEN`; the script hands it to `linode-cli` internally.

> **Relay note.** The single-VM path no longer keeps `LINODE_TOKEN` in the session — it brokers provisioning through the relay (see `linode-docker-provisioning`). LKE provisioning is **not yet** brokered that way, so today it needs an LKE-scoped token reachable by the box. Giving it a relay endpoint (so the account token stays on the relay here too) is the natural follow-up.

## Provision

```bash
RUN_ID="<jira-key-or-run-id>" \
  .claude/skills/linode-ha-provisioning/scripts/create-lke-pmm-ha.sh
```

One script: creates the LKE cluster, polls real readiness (no blind sleeps), installs the operators (`pmm-ha-dependencies`) and PMM (`pmm-ha`) via Helm, waits for HAProxy, exposes a LoadBalancer, and writes everything to a run dir (`/tmp/pmm-ha/<RUN_ID>/`): `kubeconfig.yaml`, `cluster_id`, and `summary.env` (URL + all generated passwords, mode `600`). It prints the URL and the teardown command on success.

Defaults (all overridable by env var): `REGION=us-east`, `NODE_TYPE=g6-standard-4`, `NODE_COUNT=3` (Raft quorum, tolerates one node down — not the prototype's 7), `K8S_VERSION=1.33`, `CLUSTER_LABEL=pmm-ha-<RUN_ID>`.

### Custom charts / Feature Build

To test an FB or custom Helm charts instead of the released Percona ones, override the image (and/or point the chart at a local FB path). The `pmm-ha` chart's image keys are `image.repository` / `image.tag`:

```bash
RUN_ID=PMM-14744 \
PMM_SET="image.repository=perconalab/pmm-server,image.tag=<fb-tag>" \
  .claude/skills/linode-ha-provisioning/scripts/create-lke-pmm-ha.sh
# or a whole custom chart:  PMM_CHART=/path/to/fb/pmm-ha DEPS_CHART=/path/to/fb/pmm-ha-dependencies
```

`PMM_SET` / `DEPS_SET` take comma-separated `key=value`; `PMM_VALUES` / `DEPS_VALUES` take a values.yaml. Get the FB server image (repo + tag) from the latest JNKPercona comment on the ticket's linked `pmm-submodules` PR (`fb-tests` skill) — the same source single-VM runs use. If you override to a different chart version, re-check its `values.yaml` for the image key.

## Verify HA behaviour (not just "it's up")

Standing up the cluster isn't the test. Exercise what the change actually touched (see `test-scope`'s `references/ha.md`), e.g.:

- `kubectl get pods -n pmm` — replicas, operators, HAProxy all Ready.
- Leader status: PMM's HA API / `pmm_ha_*` metrics; confirm exactly one leader.
- **Leader failover** for leader-only work (backups, scheduler, checks, telemetry, cleaner, versionCache): delete the leader pod, confirm a new leader is elected and the singleton work resumes there once — not zero times, not on every replica.
- Shared state: confirm data written on one replica is visible via another (it lives in the shared PG/ClickHouse/VM, not local `/srv`).
- UI via the LoadBalancer IP (`ui-evidence`), using `summary.env` for the admin password.

## Teardown — mandatory, every path

```bash
RUN_ID="<run-id>" .claude/skills/linode-ha-provisioning/scripts/destroy-lke.sh
# or: linode-cli lke cluster-delete "$(cat /tmp/pmm-ha/<RUN_ID>/cluster_id)"
```

Delete the cluster whether the run passed, failed, or was blocked — this is the last step, always. Unlike the single-VM path there is **no on-box self-destruct timer** here: nothing cleans an LKE cluster up for you, so skipping teardown leaks a multi-node cluster + LoadBalancer that bills until someone notices. If you also created a box with `linode-docker-provisioning`, tear that down too — it does not delete the cluster.
