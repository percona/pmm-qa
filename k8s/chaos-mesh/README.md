# Chaos Mesh on PMM HA — PMM-15262

Chaos experiments against a PMM HA cluster on Kubernetes. Chaos Mesh runs in its
own `chaos-mesh` namespace; PMM stays in `pmm`.

## Quick start

```bash
export KUBECONFIG=/path/to/kubeconfig     # an existing PMM HA cluster

./k8s/chaos-mesh/setup.sh                 # install Chaos Mesh, verify it can inject
./k8s/chaos-mesh/run-experiments.sh --list
./k8s/chaos-mesh/run-experiments.sh --hold    # run them, pausing between each
./k8s/chaos-mesh/setup.sh --uninstall     # remove Chaos Mesh, leave PMM alone
```

`run-experiments.sh` exits with the number of experiments whose fault could not
be verified or whose post-conditions regressed, so CI can gate on it.

| Flag | Effect |
| --- | --- |
| `--list` | print the catalogue and exit |
| `--only n1,n3` | run just those |
| `--skip s3` | run everything else |
| `--hold` | confirm before each experiment |
| `--include-unsafe` | also run experiments known to break this platform |

## Files

| Path | Purpose |
| --- | --- |
| `setup.sh` | install/uninstall Chaos Mesh, verify the daemon matches the node runtime |
| `run-experiments.sh` | run the catalogue, prove each fault landed, check the validation list |
| `observe.sh` | one-shot snapshot of the cluster for reading by hand |
| `lib.sh` | shared helpers — identity resolution, chaos lifecycle, measurement probes |
| `values.yaml` | Helm values; the containerd override lives here |
| `rbac-dashboard.yaml` | ServiceAccount + ClusterRole for the dashboard login token |
| `experiments/*.yaml` | one manifest per experiment, each with its rationale in the header |

## Dashboard

`securityMode` is on, so the UI needs a service-account token. Port-forward
rather than exposing a LoadBalancer — this is a chaos control plane.

```bash
kubectl create token chaos-manager -n chaos-mesh --duration=24h
kubectl port-forward -n chaos-mesh svc/chaos-dashboard 2333:2333   # http://localhost:2333
```

## Five things that cost real time on the first run

These are encoded in the scripts, but matter if you drive Chaos Mesh by hand.

**The status field lies.** `AllInjected: True` was reported four times while
nothing was happening, and once while the experiment was destroying a volume
mount — the IOChaos CR showed 7 `Failed Apply` events against 1 `Succeeded` and
still claimed injection. `run-experiments.sh` therefore proves every fault with a
direct measurement and treats the CR status as a hint. Never record a result from
an unverified injection.

**`kubectl apply` does not re-run a finished experiment.** A completed chaos
object sits in `desiredPhase: Stop`; re-applying silently no-ops and even keeps
the old duration. Always `delete` then `create`.

**A `target:` selector does not match Service traffic.** Chaos Mesh filters netem
with an ipset of target *pod IPs*, but a ClusterIP-addressed packet has not been
rewritten when it reaches the tc egress hook. Measured under an active
experiment, same destination pod: 2.5–3.8 ms via ClusterIP versus 159–248 ms
direct to the pod IP. The fix used throughout: inject on the *receiving* side,
delaying replies, which carry real pod IPs. That is why N1, N2, N4, N5 and N6
have the database component as `selector` and PMM as `target` — it reads
backwards and is deliberate. N3 is the exception: Raft peers talk over a headless
service, so it injects PMM-side directly.

**Nothing may be hardcoded that the cluster can move.** Raft leadership changes
between experiments, so the scripts resolve it before each run and repoint the
manifest's `pod-name` selector in a temp copy rather than editing the tracked
file. PostgreSQL fails over too, and that one is silent: a demoted primary
reports a near-empty connection pool that looks like a problem resolving itself.
Always resolve it with `-l postgres-operator.crunchydata.com/role=master`.

**IOChaos is destructive on cgroup v2 nodes.** It does not add latency — it
detaches the PVC from the application, leaving the container reading an empty
directory on its overlay filesystem. Deleting the chaos object does not restore
the mount; only deleting the pod does. `run-experiments.sh` skips it unless
`--include-unsafe`, and the manifest carries a DO-NOT-RUN header. `BlockChaos`
(device-mapper, no FUSE) is the untested alternative for disk latency.

## Selector safety

Experiments select PMM Server pods on `app.kubernetes.io/component=pmm-server`.
The ClickHouse Keeper pods do not carry that label, nor
`clickhouse.altinity.com/chi`, so Keeper is excluded by construction rather than
by an exclusion list a later edit could drop.

Check for PVCs pending deletion before any PodChaos round — killing a pod whose
PVC is already mid-deletion finalizes it, and the pod returns with an empty
volume:

```bash
kubectl get pvc -A -o json | jq -r '.items[]|select(.metadata.deletionTimestamp)|"\(.metadata.namespace)/\(.metadata.name)"'
```

## Before you start

The pre-flight in `run-experiments.sh` refuses to run on a degraded cluster, and
warns when PostgreSQL has fewer than 15 free connection slots. That threshold is
not arbitrary: on the cluster this was developed against, a PMM Server pod that
restarts without ~10 free slots comes back with Grafana in `FATAL` and stays
0/1 — supervisord gives up after about 60 seconds and never retries. Any
experiment that can restart a pod is unsafe below that line.

Component labels (`clickhouse.altinity.com/chi`,
`postgres-operator.crunchydata.com/instance`, `app.kubernetes.io/name: vmauth`)
are chart-version specific. Confirm them on a new cluster before trusting them:

```bash
kubectl get pod <pod> -n pmm -o jsonpath='{.metadata.labels}' | jq
```
