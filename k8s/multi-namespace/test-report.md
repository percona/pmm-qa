# PMM-15149 + PMM-15151 — combined test report

Two PMM-HA instances in two namespaces of one Kubernetes cluster, on the two chart PRs merged
together.

| | |
|---|---|
| Tickets | [PMM-15149](https://perconadev.atlassian.net/browse/PMM-15149) (New Feature), [PMM-15151](https://perconadev.atlassian.net/browse/PMM-15151) (Bug) |
| PRs under test | [percona-helm-charts#865](https://github.com/percona/percona-helm-charts/pull/865) `03da519`, [percona-helm-charts#868](https://github.com/percona/percona-helm-charts/pull/868) `ac33e22` |
| Base branch | `PMM-HA-GA` `71e656d` |
| Combined test branch | `PMM-15149-15151-combined` `5405087` (both PRs merged, no conflicts) |
| PMM Server image | `perconalab/pmm-server:3-dev-latest` → `3.10.0-v3-69252e51f` (digest `sha256:8eb860c5…`) |
| Cluster | Linode LKE `649532`, 5 × g6-standard-6, Kubernetes v1.36.3 |
| Namespaces | `pmm` (release `pmm-ha`) and `pmm-dr` (release `pmm-dr`) |
| Verdict | **Both tickets' acceptance criteria met.** 25 scenarios run, 23 pass. 4 defects found — none introduced by these PRs, but 2 of them land directly on the multi-namespace path these PRs document. |

Reproduce with [`build-test-branch.sh`](build-test-branch.sh) then [`install.sh`](install.sh).
Raw command output is under [`evidence/logs/`](evidence/logs/), screenshots and clips under
[`evidence/ui/`](evidence/ui/).

## Why the two PRs had to be tested together

They are not independent:

- Both branch off `PMM-HA-GA` and both edit `charts/pmm-ha/templates/_helpers.tpl` and
  `charts/pmm-ha/templates/vmagent.yaml`. Git merges them cleanly, but only the merged
  `vmagent.yaml` has both #865's `kube-state-metrics` gate and #868's
  `Release.Name`/`regexQuoteMeta` selector split.
- Neither alone delivers a working second namespace. Without #868 the second instance's
  `PerconaPGCluster`/`ClickHouseInstallation` are never reconciled; without #865 its bundled
  `prometheus-node-exporter` cannot start.

`helm lint` passes on both charts on the merged branch; `helm dependency build` resolves.

## Release name is the crux

`pmm.fullname` returns `Release.Name` only when the release name already contains the chart
name. The second instance is deliberately called `pmm-dr`, so:

| | primary | second instance |
|---|---|---|
| Release name | `pmm-ha` | `pmm-dr` |
| `pmm.fullname` | `pmm-ha` | `pmm-dr-pmm-ha` |
| StatefulSet / PMM pods | `pmm-ha-{0,1,2}` | `pmm-dr-pmm-ha-{0,1,2}` |
| ClickHouseInstallation | `pmm-ha` | `pmm-dr` |

In the primary the two names coincide, so it cannot catch the regression #868 fixes. Only the
`pmm-dr` instance exercises it — the same reason #868 adds a `helm template pmm-2` CI guard.

## Scenario results

### PMM-15151 — operators must watch all namespaces

| # | Scenario | Result |
|---|---|---|
| 1 | Baseline: released `pmm-ha-dependencies` 1.0.0 is namespace-scoped — `pg-operator` has a namespaced `Role`/`RoleBinding`, ClickHouse `WATCH_NAMESPACES` unset | **Confirmed** ([log](evidence/logs/s1-operators-before.txt)) |
| 2 | **NEG (the bug):** install `pmm-ha` into `pmm-dr` while operators are still namespace-scoped → `PerconaPGCluster` and `ClickHouseInstallation` created with **empty status** (never reconciled), `VMCluster`/`VMAgent`/`VMAuth` `operational` (VM operator already cluster-scoped), PMM pod parked at `Init:1/2` with `wait-for-clickhouse` looping, HAProxy at `Init:0/1` | **Reproduced exactly as documented** ([log](evidence/logs/s3-neg-order-state.txt), [symptom](evidence/logs/s3b-neg-order-symptom.txt)) |
| 3 | **NEG:** `helm upgrade pmm-ha-operators` (the name the new docs use) against an install that predates the change → `Error: "pmm-ha-operators" has no deployed releases`; the documented `helm list` finds the real name `pmm-operators` | **Confirmed — the README's warning is accurate and necessary** ([log](evidence/logs/s4-wrong-release-name.txt)) |
| 4 | Upgrade the existing `pmm-operators` release to the merged chart → `NOTES.txt` prints the cluster-wide `🌐 SCOPE` block and the blast-radius uninstall warning | **Pass** ([log](evidence/logs/s5-deps-upgrade.txt)) |
| 5 | `pg-operator` RBAC switches namespaced `Role`/`RoleBinding` → `ClusterRole`/`ClusterRoleBinding`; `WATCH_NAMESPACE` set empty (all namespaces); ClickHouse `WATCH_NAMESPACES=.*` on **both** the operator and the `metrics-exporter` sidecar | **Pass** ([log](evidence/logs/s6-operators-after.txt)) |
| 6 | Documented `kubectl rollout status` waits behave as the README says (`kubectl wait` would false-green on `strategy: Recreate`) | **Pass** |
| 7 | **Acceptance criterion:** after the operator upgrade alone — no reinstall, no edit of the `pmm-dr` release — PG and ClickHouse are reconciled and the second instance converges to 3/3 | **Pass** ([log](evidence/logs/s7-recovery.txt)) |
| 8 | `PMM_HA_PEERS` on the second instance uses the StatefulSet name; all three peers resolve in DNS, while the pre-fix `Release.Name` form (`pmm-dr-0…`) resolves to nothing | **Pass** ([log](evidence/logs/s14-ha-dr.txt)) |
| 9 | HAProxy init ConfigMap renders `pmm_host="pmm-dr-pmm-ha-$i…"`; its init-container log shows all 3 instances reached and "All PMM instances are ready" | **Pass** |
| 10 | vmagent ClickHouse/Keeper scrape selectors use `Release.Name` (`pmm-dr`, `pmm-dr-keeper`) while VM-service selectors use the escaped fullname → `clickhouse 3/3 up`, `clickhouse-keeper 3/3 up`, all `vm*` jobs up **in both namespaces** | **Pass** ([log](evidence/logs/s15-vmagent-targets.txt)) |
| 11 | #868's own CI guard replayed against the live cluster for release `pmm-2`, plus `regexQuoteMeta` with a dotted release name (`pmm.ha` → `regex: 'pmm\.ha'`) | **7/7 assertions pass** ([log](evidence/logs/s10-release-name-render.txt)) |
| 12 | **NEG:** reinstall `pmm-ha-dependencies` into the second namespace → fails with `invalid ownership metadata … release-namespace must equal "pmm-clash": current value is "pmm"` on the retained CRDs | **Confirmed as documented** ([log](evidence/logs/s8-neg-deps-second-ns.txt)) |

### PMM-15149 — pmm-ha installable into multiple namespaces

| # | Scenario | Result |
|---|---|---|
| 13 | Default install unchanged: primary keeps `kube-state-metrics` (1/1) and `prometheus-node-exporter` (5/5), both scrape jobs present and up | **Pass** |
| 14 | Second instance with both subcharts off → vmagent config has **no** `kube-state-metrics` and **no** `node-exporter` job, while `kubelet` (5/5) and `cadvisor` (5/5) remain — exactly the documented trade-off | **Pass** ([log](evidence/logs/s12-vmagent-gating.txt)) |
| 15 | Toggle `kube-state-metrics.enabled=true` on the second instance → own `pmm-dr-kube-state-metrics` Deployment and `ClusterRole` alongside the primary's, no collision, vmagent job reappears and its target goes `up` | **Pass** ([log](evidence/logs/s16-ksm-enable.txt)) |
| 16 | **NEG:** enable the bundled `prometheus-node-exporter` on the second instance → all 5 DaemonSet pods `Pending`, `0/5` ready, scheduler says **"didn't have free ports for the requested pod ports"**; the primary's DaemonSet stays 5/5 | **Confirmed — the host-port-9100 reason in the docs is real** ([log](evidence/logs/s18-neg-node-exporter.txt)) |
| 17 | Chart warns at install time when `nodeExporter.mode: internal` is combined with the subchart disabled | **Pass** ([log](evidence/logs/s2-install-pmm-dr.txt)) |
| 18 | **NEG:** a second `pmm-ha` release in the **same** namespace → aborts on a fixed-name resource (`ServiceAccount "pmm-ha-haproxy" … must equal "pmm-ha-2"`); no release record created, existing instance untouched | **Confirmed** ([log](evidence/logs/s19-neg-same-namespace.txt)) |
| 19 | **NEG:** the **same** release name in a different namespace → aborts on cluster-scoped RBAC (`ClusterRole "pmm-ha-kube-state-metrics" … release-namespace must equal "pmm-clash"`) | **Confirmed** ([log](evidence/logs/s9-neg-same-release-name.txt)) |
| 20 | Documented discovery command `helm list -A -o json \| jq … test("^pmm-ha-[0-9]")` finds both instances by chart, despite differing release names | **Pass** |
| 21 | Each instance gets its own HAProxy LoadBalancer and answers `/v1/readyz` 200 externally; Grafana/PG state is per-namespace | **Pass** ([log](evidence/logs/s22-final-state.txt)) |

### HA behaviour, roles, security

| # | Scenario | Result |
|---|---|---|
| 22 | Exactly one Raft leader per instance, 3 voters up, same term — independently in each namespace | **Pass** ([primary](evidence/logs/s13-ha-primary.txt), [DR](evidence/logs/s14-ha-dr.txt)) |
| 23 | Leader failover in the second namespace: delete the leader → term 2→3, a new single leader is elected, the instance still serves through HAProxy, and the primary's leader is unaffected | **Pass** ([log](evidence/logs/s20-ha-failover.txt)) |
| 24 | Credential isolation: each instance's admin password is rejected by the other (401 both ways) | **Pass** |
| 25 | Documented tenancy caveat verified: each instance's `pmm-service-account` holds **cluster-wide get *and delete* on Secrets** — the `pmm-dr` SA can read the primary's `pmm-secret`, and either SA can delete Secrets in `kube-system`. Each instance's `kube-state-metrics` reads whole-cluster object state, so the second instance's dashboards show all 5 nodes / 101 pods, not just its namespace | **Documented behaviour confirmed** ([log](evidence/logs/s11-security-rbac.txt), [screenshot](evidence/ui/13-dr-k8s-cluster.png)) |

Namespaces are therefore **not** a security boundary here, exactly as `pmm-ha-dependencies`
README now states. The `delete` verb is worth a second look on its own merits (see D4).

## Defects found

None of the four is introduced by #865 or #868 — all four are in `PMM-HA-GA` or in
`percona/pmm` — but D1 and D2 only bite on the multi-namespace path these PRs document, so they
should be fixed alongside.

### D1 — the HA Health Overview dashboard reports a healthy second instance as broken

Severity: high for this feature — it is the first screen an operator opens.

`PMM HA Health Overview` has the *same* `Release.Name`-vs-`pmm.fullname` confusion that #868
fixed in the chart, but in the dashboard (`percona/pmm`, not the chart), so it is still there.

Its `release` variable resolves from a PMM pod label, so it is the **fullname**
(`pmm-dr-pmm-ha`), while PG and ClickHouse pods are named from **`Release.Name`**:

| Panel | Regex it builds | Actual pods | Result |
|---|---|---|---|
| 🐘 PostgreSQL | `pmm-dr-pmm-ha-pg-db-.*` | `pmm-dr-pg-db-instance1-…` | no match → **Not Healthy** |
| 🖱️ ClickHouse | `pmm-dr-pmm-ha-(pmmdb\|keeper).*` | `pmm-dr-pmmdb-0-0-0` | no match → **Not Healthy** |
| 📊 VictoriaMetrics | `(vmstorage\|…).*pmm-dr-pmm-ha.*` | `vmstorage-pmm-dr-pmm-ha-…` | match → Healthy |
| ⚖️ HAProxy | fixed `pmm-ha-haproxy.*` | `pmm-ha-haproxy-…` | match → Healthy |

On the primary, fullname == release name, so every panel matches and the dashboard is all green
— which is why this is invisible until you install into a second namespace.

Two further defaults on the same dashboard: the `namespace` variable is populated from
`label_values(kube_pod_info, exported_namespace)` (cluster-wide, since kube-state-metrics has
cluster-wide read), so it opens on **`kube-system`** and *every* panel reads "Not Healthy" until
the user changes it; and the saved defaults are the authors' `demo` / `pmm-ha-demo`.

Evidence: [primary, all green](evidence/ui/07-primary-ha-health-scoped.png) ·
[second instance, all red](evidence/ui/08-dr-ha-health-scoped.png) ·
[second instance after enabling KSM — PMM/VM/HAProxy go green, PG+ClickHouse stay red](evidence/ui/09-dr-ha-health-ksm-enabled.png) ·
[dashboard opened on kube-system](evidence/ui/04-dr-ha-health.png) ·
[queries](evidence/logs/s21-dashboard-release-name-bug.txt) · clips
[primary](evidence/ui/vid-01-primary-ns-pmm-ha-health.mp4),
[second instance](evidence/ui/vid-02-dr-ns-pmm-dr-ha-health.mp4).

Suggested fix: build the PG/ClickHouse panel regexes from the ClickHouseInstallation /
PerconaPGCluster name (i.e. `Release.Name`) rather than the PMM pod's fullname, and default
`namespace` to the instance's own namespace.

**Knock-on for #865:** the README calls `kube-state-metrics` "optional … or disable it to save a
small Deployment" and says the only cost is that object-state metrics aren't collected. In fact
the whole HA Health Overview goes red without it (`PMM`, `VictoriaMetrics` and `HAProxy` flip to
Healthy the moment KSM is enabled — screenshots above). Worth either recommending it stays on,
or saying plainly that the HA health dashboard needs it.

### D2 — `pmm-secret`'s `PMM_ADMIN_PASSWORD` is never applied when `secret.create: false`

Severity: high, security-relevant.

`statefulset.yaml` sets `GF_SECURITY_ADMIN_PASSWORD` from `pmm-secret` **only inside
`{{ if .Values.secret.create }}`**. With the default `secret.create: false` — the path the
production and multi-namespace docs both tell you to use ("create the `pmm-secret` in `pmm-dr`
too") — the chart instead `envFrom`s the whole secret, which puts `PMM_ADMIN_PASSWORD` in the
container env but never sets Grafana's admin password.

Observed on this cluster:

- Primary instance: the admin account was reachable with **`admin` / `admin`** on a public
  LoadBalancer, and the password from `pmm-secret` returned 401.
- Second instance: the `pmm-secret` password returned 401 as well.
- The chart's own `pg-pmm-token-job` authenticates with `PMM_ADMIN_PASSWORD` and so fails:
  `pmm-ha-pmm-token-init` ended **Failed** with
  `{"message":"Invalid username or password","statusCode":401}`.

Both instances were then fixed with `change-admin-password`, which is how the credentials in the
handover below were set.

Suggested fix: set `GF_SECURITY_ADMIN_PASSWORD` from `secret.name`/`PMM_ADMIN_PASSWORD`
regardless of `secret.create` (the key is required either way — `secret.yaml` already defaults
it), and fail the install if it is absent.

### D3 — `helm upgrade` becomes permanently impossible after the PG operator recreates a user secret

Severity: medium. Specific to the second namespace in this run.

`templates/pg-user-credentials-secrets.yaml` creates `gfuser-credentials` and
`pmmuser-credentials` as `pre-install,pre-upgrade` hooks with **no `hook-delete-policy`**. In
`pmm-dr` the PG cluster sat unreconciled for ~15 min (scenario 2) and when PGO finally picked it
up it recreated `gfuser-credentials` itself — its `managedFields` owner became
`postgrescluster-controller` alone and Helm's `meta.helm.sh/*` annotations were gone. Every
subsequent `helm upgrade pmm-dr` then failed:

```
Error: UPGRADE FAILED: pre-upgrade hooks failed: warning: Hook pre-upgrade
pmm-ha/templates/pg-user-credentials-secrets.yaml failed: 1 error occurred:
	* secrets "gfuser-credentials" already exists
```

The primary namespace, where the operators were cluster-wide before the PG cluster came up, is
unaffected — both its secrets still carry Helm's annotations. Worked around by re-adding the
annotations by hand. ([log](evidence/logs/s17-upgrade-hook-bug.txt))

This is a second, quieter sense in which the docs' "not recoverable by retrying" ordering
warning is true: the release survives but can no longer be upgraded. Suggested fix: add
`helm.sh/hook-delete-policy: before-hook-creation` to those two secrets.

### D4 — smaller observations

- **QAN ClickHouse migrations race across replicas.** On the second instance, replica 1 started
  its `qan-api2` migrations from version 1 while replica 0 had already reached 22 — it read a
  stale ClickHouse replica of `pmm.schema_migrations`, wrote `version=1, dirty=1` at a later
  sequence and poisoned the shared table, leaving replica 1 crash-looping on
  `migrations: Dirty database version 1. Fix and force version.` Cleared by deleting the
  poisoning row. `qan-api2` migrations are not serialised across HA replicas and do not tolerate
  a stale read; this surfaced here because the pods restarted while ClickHouse was still
  converging.
- **`kube-apiserver` scrape job is down in both namespaces** (`0/1 up`) — identical in the
  primary and the second instance, so unrelated to these PRs, but it means the job never worked
  on LKE.
- **The `pmm-service-account` ClusterRole grants `delete` on Secrets, ServiceAccounts, PVCs and
  Pods cluster-wide.** The new README documents it, which is the right call, but cluster-wide
  `delete` on Secrets is a large grant for a monitoring server and is worth narrowing on its own
  merits.
- **`pw-record.js` in this repo did not support `PMM_UI_INSECURE`**, so the HA/LKE path could not
  record video at all (`ERR_CERT_AUTHORITY_INVALID`). Fixed in this branch, mirroring
  `pw-screenshot.js`.

## Note on test-cluster sizing

Two default-sized PMM-HA stacks request ~31 CPU and did not fit 5 × g6-standard-6 (~29.5 CPU
allocatable) — the second instance's ClickHouse pods stayed `Pending` on `Insufficient cpu`. The
second instance's `pmmResources` and `clickhouse.resources` **requests** were trimmed
([values-second-namespace.yaml](values-second-namespace.yaml)); its topology is unchanged (3 PMM
replicas, 3 ClickHouse, 3 Keeper, 3 PG), so everything under test is exercised at full shape.
Worth knowing when sizing a real two-instance cluster: budget ~16 CPU of requests per instance.
