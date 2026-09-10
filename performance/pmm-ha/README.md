# PMM HA performance profiles — small / medium / large

Sizing for PMM HA load tests at three fleet sizes, as ready-to-use Helm values plus
the cluster each one needs.

| Profile | Monitored databases under load | Values file |
| --- | --- | --- |
| Small | up to 50 | [`values-perf-small.yaml`](values-perf-small.yaml) |
| Medium | 50 – 200 | [`values-perf-medium.yaml`](values-perf-medium.yaml) |
| Large | 200 – 500 | [`values-perf-large.yaml`](values-perf-large.yaml) |

Each profile is sized at the **top** of its band, so one file covers the whole range.

```bash
./k8s/install_pmm_ha.sh --platform eks \
    --values performance/pmm-ha/values-perf-medium.yaml
```

Every profile restates each resource block in full, including the ones equal to the
chart default, so a run's sizing is readable from one file and a chart-default change
cannot silently move the design point out from under a published result.

## Where the numbers come from

Upstream's [`docs/SIZING.md`](https://github.com/percona/percona-helm-charts/blob/PMM-HA-GA/charts/pmm-ha/docs/SIZING.md)
is the model; these profiles apply it to database counts instead of node counts. Its
planning unit is one monitored node ≈ **5,000 active series** (a host plus one database
service with QAN), and the chart's own vmagent adds a fixed **~165,000 series** of
Kubernetes baseline — kubelet, cAdvisor, kube-apiserver, kube-state-metrics — before a
single database is monitored.

| | Small (50 DB) | Medium (200 DB) | Large (500 DB) |
| --- | --- | --- | --- |
| Database series | 250k | 1.00M | 2.50M |
| \+ Kubernetes baseline | 165k | 165k | 165k |
| **Active series** | **415k** | **1.17M** | **2.67M** |
| Node-equivalents | ~83 | ~233 | ~533 |
| Ingest rate | ~30k samples/s | ~83k samples/s | ~190k samples/s |
| Metrics growth (replicationFactor 2) | 2.3 GB/day | 6.5 GB/day | 14.8 GB/day |
| QAN growth **per ClickHouse replica** | 0.3 GB/day | 1.2 GB/day | 2.9 GB/day |

So **small lands inside the chart's own ~100-node default profile** — its resource
blocks are the defaults. Medium interpolates between the default and the ~500-node
profile, rounded up on the write path. Large matches the ~500-node profile on CPU and
memory, but with **larger volumes**, because the Kubernetes baseline pushes 500
databases just past that profile's design point.

Cardinality varies enormously by workload. **MySQL with per-table statistics and
MongoDB with many collections run 8,000–15,000 series per node, two to three times the
planning default** — with either, size one tier up or expect the ingest numbers above
to be low by that factor.

## Cluster level

Requests and limits totalled from the profiles themselves (`kube-state-metrics` and the
per-node `node_exporter` DaemonSet included):

| | Small | Medium | Large |
| --- | --- | --- | --- |
| CPU requests | ~16.5 | ~25 | ~33 |
| CPU limits (aggregate) | ~54 | ~78 | ~99 |
| Memory requests | ~40Gi | ~64Gi | ~86Gi |
| Memory limits (aggregate) | ~96Gi | ~149Gi | ~197Gi |
| Persistent storage | 471Gi | 801Gi | ~1.7Ti |
| Pod count (PMM HA workloads) | 33 | 34 | 34 |

### Worker nodes

**Size on limits, not requests.** Requests only decide scheduling; a load test is
precisely the burst the limits exist for. A cluster that merely fits the requests will
CFS-throttle the write path under exactly the conditions being measured, and produce
numbers that are an artifact of the node size.

| | Small | Medium | Large |
| --- | --- | --- | --- |
| **Recommended (perf-grade)** | 3 × 16 vCPU / 64Gi | 6 × 16 vCPU / 64Gi | 9 × 16 vCPU / 64Gi |
| Nodes per AZ (3 AZs) | 1 | 2 | 3 |
| Allocatable total | ~48 vCPU / ~174Gi | ~95 vCPU / ~348Gi | ~143 vCPU / ~522Gi |
| Hot-path concurrent peak | ~38 vCPU | ~56 vCPU | ~72 vCPU |
| EKS instance | `m6i.4xlarge` | `m6i.4xlarge` | `m6i.4xlarge` |
| **Minimum that schedules** | 3 × 8 vCPU / 32Gi | 3 × 16 vCPU / 64Gi | 3 × 16 vCPU / 64Gi |

One instance type across all three tiers, scaling by node count — the node group is the
only thing that changes between runs.

"Hot-path concurrent peak" is the sum of limits for the components a client-buffer
replay hits at once (leader PMM, HAProxy, vmauth, vminsert, vmstorage, vmselect,
ClickHouse, PostgreSQL). Aggregate limits exceed allocatable on purpose — not every pod
peaks together — but that hot path must fit, and it does at every recommended size.

The "minimum that schedules" row fits the *requests* only, and its hot path is 1.2–2×
allocatable at every tier. Those clusters install and stay green, so they are fine for
functional HA work, and they will silently throttle a load test.

**Three workers is a hard floor.** `pg-db` keeps a *required* podAntiAffinity on
`kubernetes.io/hostname` for its 3 PostgreSQL replicas, so a fourth replica or a
third-node outage leaves pods Pending. HAProxy uses a soft topology spread and will
co-locate instead (upstream PMM-15393), so it is not the binding constraint.

**Size per AZ, not just in total.** EBS and equivalent volumes are AZ-local, so once a
vmstorage, ClickHouse, or PostgreSQL pod has a volume it cannot move AZ. Each AZ needs
room for one replica of each stateful set, both at steady state and while a node in that
AZ is being replaced.

### EKS specifics

* **EBS CSI driver addon is required** — without `aws-ebs-csi-driver` every PVC stays
  Pending and the install times out with no obvious cause.
* **Storage class needs `allowVolumeExpansion: true`.** Every sizing correction at this
  scale is a PVC expansion; without it the only fix is a reinstall. Define a `gp3` class
  rather than relying on the default `gp2`.
* **Keep the worker pool homogeneously amd64.** QAN requires SSE4.2 and PMM Server has
  no native ARM64 build, so both PMM and ClickHouse need amd64 nodes. The profiles pin
  the PMM pods via `nodeSelector`, but **ClickHouse cannot be pinned from values** — this
  chart version exposes no `clickhouse.nodeSelector` and hardcodes its podTemplate
  affinity. On Karpenter, EKS Auto Mode, or any pool that can supply Graviton, ClickHouse
  will eventually land on ARM64 and fail with nothing in the values file able to prevent
  it. Use a single amd64 instance type for the pool.
* **Large: raise volume throughput.** `gp3` defaults to 3,000 IOPS / 125 MiB/s per
  volume. Provision ~6,000 IOPS / 250 MiB/s for the vmstorage and ClickHouse volumes, or
  disk becomes the bottleneck and gets misattributed to PMM.

### ROSA / OpenShift specifics

* Pass `--platform openshift` to `install_pmm_ha.sh`. It sets
  `nodeExporter.mode=openshift` and disables the bundled DaemonSet, because OpenShift
  already runs a node-exporter on host port 9100 — otherwise that DaemonSet stays
  Pending forever and `--wait` never returns.
* **OpenShift reserves noticeably more per node than EKS.** Add roughly 1 vCPU and 3–4Gi
  per node to the overhead above, or take one size up.
* **Multi-AZ ROSA requires the worker count to be a multiple of 3** — which the 3 / 6 / 9
  recommendation already satisfies.
* Use the `gp3-csi` storage class; it already has `allowVolumeExpansion: true`.
* On ROSA Classic the control-plane and infra nodes are separate and host none of this,
  so only the worker machine pool needs the sizing above. On ROSA HCP the control plane
  is hosted, so the same holds.

## Pod level

`request → limit` for CPU and memory, and PVC size **per pod**. Bold marks a value
raised above the chart default.

| Component | × | Small | Medium | Large |
| --- | --- | --- | --- | --- |
| PMM Server | 3 | 2→4 · 4Gi→8Gi · 40Gi | **3→6 · 6Gi→12Gi** · 40Gi | **4→8 · 8Gi→16Gi** · 40Gi |
| HAProxy | 3 | 250m→1 · 128Mi→512Mi | **400m→1500m · 192Mi→768Mi** | **500m→2 · 256Mi→1Gi** |
| vminsert | 2 / **3** / **3** | 200m→1 · 512Mi→2Gi | **300m→1500m · 768Mi**→2Gi | **500m→2 · 1Gi**→2Gi |
| vmstorage | 3 | 500m→2 · 2Gi→4Gi · 50Gi | **750m→3 · 4Gi→8Gi · 100Gi** | **1→4 · 6Gi→12Gi · 250Gi** |
| vmselect | 2 | 500m→2 · 1Gi→4Gi | **750m→3 · 1536Mi→6Gi** | **1→4 · 2Gi→8Gi** |
| vmauth | 2 | 100m→500m · 128Mi→512Mi | **200m→750m · 192Mi→768Mi** | **300m→1 · 256Mi→1Gi** |
| vmagent | 2 | 250m→1 · 512Mi→1Gi | unchanged | unchanged |
| ClickHouse | 3 | 1→4 · 4Gi→8Gi · 50Gi | **1500m→5 · 6Gi→12Gi · 100Gi** | **2→6 · 8Gi→16Gi · 250Gi** |
| CH Keeper | 3 | 250m→1 · 512Mi→1Gi · 5Gi | unchanged · 5Gi | unchanged · **10Gi** |
| PostgreSQL | 3 | 500m→2 · 1Gi→4Gi · 10Gi | **750m→3 · 1536Mi→6Gi · 20Gi** | **1→4 · 2Gi→8Gi · 30Gi** |
| pgBouncer | 3 | 100m→500m · 128Mi→512Mi | **150m→750m · 192Mi→768Mi** | **250m→1 · 256Mi→1Gi** |
| PMM Client | 3 | 100m→500m · 200Mi→1Gi · 2Gi | **200m→1 · 512Mi→2Gi** · 2Gi | **250m→1 · 512Mi→2Gi** · 2Gi |
| kube-state-metrics | 1 | 100m→500m · 128Mi→512Mi | unchanged | unchanged |
| node-exporter | per node | 50m→200m · 64Mi→128Mi | unchanged | unchanged |

Why the request/limit gaps are wide, and where they are not:

* **Only the leader works.** HAProxy health-checks `/v1/server/leaderHealthCheck`, so a
  single PMM pod serves every UI request, every client `remote_write` and all QAN
  traffic while the other two are warm standbys. The limit carries the whole fleet; the
  request is paid three times over. Keeping the request near half the limit buys
  failover headroom without reserving triple the capacity in use.
* **Clients replay after an outage.** Each PMM client buffers up to 1GB on disk when the
  server is unreachable and pushes it as fast as it can on reconnect. A failover or
  rolling upgrade releases all of it at once, so HAProxy, vmauth, vminsert and vmstorage
  need three to five times steady state.
* **vmstorage is the exception.** VictoriaMetrics sizes its internal caches from the
  cgroup memory limit, so a wide gap there invites node overcommit and an OOM kill under
  load. Its request stays within ~2× its limit at every tier.
* **vmagent does not scale with the fleet.** It scrapes the Kubernetes control plane and
  the PMM components, not the monitored databases, so it is unchanged across all three.

## Four things that will invalidate the run

### 1. Keep the load off the cluster under test

The databases and their load generators must not run on the PMM HA cluster. Co-locating
them makes the load generator compete for CPU, memory and disk with the system being
measured, and the result describes the test rig rather than PMM.

Drive load from outside — the [`performance/`](../) Linode harness already does this, or
use a separate node group tainted so only load pods land on it, sized independently of
every table above. Each load host runs `pmm-agent` in push mode, so PMM Server sees one
Node and one Service per database.

Rough load-fleet cost: ~10–20 database containers under light `sysbench` per
8 vCPU / 32Gi host, so 500 databases is on the order of 25–50 such hosts — usually more
hardware than the PMM cluster itself.

The chart's `pmmClient` pods stay at the default 3 in all three profiles. They exist so
remote, RDS and Azure services have a Node to be added to; they are **not** the load
generators. If a run deliberately tests in-cluster remote monitoring, keep it to ~25
services per client pod and give those pods their own tainted node group.

### 2. Retention against PVC size

The chart ships **90-day** metrics retention while `vmstorage.storageSize` defaults to
**50Gi**, which holds about 30 days at 100 nodes. When a vmstorage PVC fills,
VictoriaMetrics **stops accepting writes** rather than expiring old data — which
surfaces in a load test as ingest gaps and missing graphs, and reads exactly like a PMM
ingestion defect.

All three profiles therefore pin `dataRetentionDays: 30`, matching the volumes they
declare. At 90 days these profiles would need roughly 90Gi / 250Gi / 580Gi per
vmstorage pod instead.

Two consequences of setting it, both intended here: it overrides
`vmstorage.retentionPeriod`, and it sets `PMM_DATA_RETENTION`, so **PMM refuses to change
data retention from the UI or API** while it is set. Test that path on a deployment that
leaves it empty. Lowering it on a running install deletes data older than the new window
on the next reconcile, with no confirmation.

### 3. QAN is not sharded, and ClickHouse logs its own noise

Every ClickHouse replica holds a **full** copy of Query Analytics — three copies of the
QAN volume, not a third each. A QAN row costs ~20 bytes against well under a byte for a
metric sample, so ClickHouse, not vmstorage, is usually what fills first under load.

The QAN figures above assume 200 rows/min per service. **Sustained synthetic load runs
several times that**, which is why the ClickHouse volumes here carry more margin than
the metrics math alone implies.

ClickHouse's own `system.*` log tables have been measured at many times the size of the
actual QAN data on a lightly loaded install. If ClickHouse storage becomes the
constraint, set a TTL on those tables or disable `trace_log` and
`asynchronous_metric_log` before growing the volume.

### 4. Confirm you were not throttled

A CPU limit throttles via CFS quota in bursts, well before average utilisation looks
high. Check it before trusting any latency number:

```promql
rate(container_cpu_cfs_throttled_seconds_total{namespace="pmm-ha"}[5m]) > 0
```

Any sustained throttling on the leader PMM pod, vminsert or vmstorage means the result
is a measurement of the limit, not of PMM. Either move up a node size or, for a
capacity-discovery run, drop the CPU limits entirely (keep the memory limits — memory
has no equivalent of throttling, it just OOM-kills) and measure real demand.

## What to measure

Against vmselect, for the ingest path:

```promql
sum(vm_cache_entries{type="storage/hour_metric_ids"})   # active series (÷ replicationFactor)
sum(rate(vm_rows_inserted_total[10m]))                  # ingest, samples/s
sum(vm_data_size_bytes) - sum(sum(vm_data_size_bytes) offset 1d)   # real disk growth/day
```

Dividing disk growth by ingest rate gives the real bytes-per-sample for this workload —
feed it back in place of the model's conservative 0.9 for a number specific to the fleet.

The signals that actually say PMM is not keeping up:

| Signal | Metric |
| --- | --- |
| Client backlog not draining | `vmagent_remotewrite_pending_data_bytes` |
| Samples being dropped | `vmagent_remotewrite_packets_dropped_total` |
| Insert path rejecting | `rate(vm_rows_ignored_total[5m])`, vminsert 5xx via vmauth |
| Volumes filling | `kubelet_volume_stats_available_bytes` |
| Throttling | `container_cpu_cfs_throttled_seconds_total` (see above) |
| Restarts under load | `kube_pod_container_status_restarts_total` |
| Raft/leader churn | `pmm_ha_*` |

For QAN volume, against ClickHouse:

```sql
SELECT formatReadableSize(sum(bytes_on_disk)) AS disk, sum(rows) AS nrows,
       round(sum(bytes_on_disk) / nullIf(sum(rows), 0), 1) AS bytes_per_row
FROM system.parts WHERE active AND database = 'pmm' AND table = 'metrics';
```

Run the HA functional suite **while the load is running**, not only before it — leader
election and failover behaving correctly on an idle cluster says little about behaving
correctly at 500 databases. The `@pmm-ha` tagged tests live in
[`e2e_tests/tests/ha/`](../../e2e_tests/tests/ha/).

## Related

* [`k8s/install_pmm_ha.sh`](../../k8s/install_pmm_ha.sh) — provisions PMM HA on
  EKS / LKE / OpenShift; `--values` takes these profiles, `VALUES_FILES` takes a
  colon-separated list of them.
* Upstream [`docs/SIZING.md`](https://github.com/percona/percona-helm-charts/blob/PMM-HA-GA/charts/pmm-ha/docs/SIZING.md)
  and the [500](https://github.com/percona/percona-helm-charts/blob/PMM-HA-GA/charts/pmm-ha/examples/values-500-nodes.yaml)
  / [1000](https://github.com/percona/percona-helm-charts/blob/PMM-HA-GA/charts/pmm-ha/examples/values-1000-nodes.yaml)-node
  example profiles these are derived from.
* [`performance/`](../) — the existing PMM client load harness.
