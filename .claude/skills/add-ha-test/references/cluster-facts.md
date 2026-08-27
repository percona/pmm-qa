# PMM HA cluster facts

Everything here is from `charts/pmm-ha` in
[percona-helm-charts](https://github.com/percona/percona-helm-charts) and
verified against a live ROSA deployment. The chart to deploy is the `PMM-HA-GA`
branch (the HA GA chart, still unmerged) — or the change's own chart PR when it has
one; see [`linode-ha-provisioning`](../../linode-ha-provisioning/SKILL.md).

## Topology

| Thing | Value |
| --- | --- |
| Chart | `charts/pmm-ha` (chart version and `appVersion` are independent) |
| Prerequisite | `charts/pmm-ha-dependencies` — VictoriaMetrics, Altinity ClickHouse and PG operators, installed first |
| Namespace | `pmm` (the `K8sHelper` constructor default) |
| StatefulSet | release name, e.g. `pmm-ha` → pods `pmm-ha-0/1/2` |
| `replicas` | 3 by default; `maxReplicas: 10` only sizes the HAProxy server-template |
| Storage | PVC `pmm-storage` mounted at `/srv` — **survives pod restarts** |
| Container port | 8443 (https) |
| Readiness | `GET /v1/readyz` |
| External access | the `haproxy` subchart; `monitoring-service` is a headless ClusterIP for in-cluster use |
| Data stores | external ClickHouse, VictoriaMetrics cluster and PostgreSQL (`pg-db` subchart), all as operator CRs |

## Labels

From `pmm.selectorLabels` in `templates/_helpers.tpl`:

```yaml
app.kubernetes.io/name: pmm-ha            # the CHART name, not "pmm"
app.kubernetes.io/instance: <release>
app.kubernetes.io/component: pmm-server
app.kubernetes.io/part-of: percona-platform
```

Use **`app.kubernetes.io/component=pmm-server`** to select the PMM Server pods —
it is independent of the release name. `pmmServerPodSelector` in
`haCluster.helper.ts` is exactly this.

`app.kubernetes.io/name=pmm` — used by `k8s/k8s_helper.sh` for the single-node
`charts/pmm` deployments — **matches nothing on HA**, because the value is the
chart name and this chart is `pmm-ha`.

## Node id is the pod name, by construction

```yaml
- name: PMM_HA_NODE_ID
  valueFrom:
    fieldRef:
      fieldPath: metadata.name
```

`PMM_HA_NODE_ID` becomes the memberlist node name and the Raft `ServerID`, so
all of these are the same string:

- the pod name (`pmm-ha-0`)
- `node_name` in `/v1/ha/nodes`
- the `node_id` label on `pmm_ha_*` metrics
- the Node Name shown on the Inventory Nodes page
- the name in the sidebar's "Leader:" row

That is what makes `kubectl delete pod <leader-from-the-API>` valid. It is a
chart guarantee, not a coincidence — but assert the pod exists before deleting
it so a future chart change fails loudly.

## HAProxy routes to the leader only

```haproxy
backend https_back
    option httpchk
    http-check send meth GET uri /v1/server/leaderHealthCheck ver HTTP/1.1 hdr Host www
    http-check expect status 200
    server-template pmm 1-10 monitoring-service.<ns>.svc.cluster.local:8443 check ssl verify none ...
```

Consequences:

- **Every external request lands on the leader.** Kill it and the API 5xxs until
  a new one is elected.
- `/v1/server/leaderHealthCheck` returns **200 on the leader, 400 on followers**
  — a deterministic, per-pod leader oracle:

```bash
for p in pmm-ha-0 pmm-ha-1 pmm-ha-2; do
  printf '%s -> ' "$p"
  kubectl exec -n pmm "$p" -c pmm-ha -- \
    curl -sk -o /dev/null -w '%{http_code}\n' https://127.0.0.1:8443/v1/server/leaderHealthCheck
done
```

## Leadership internals

Leadership is hashicorp/raft inside pmm-managed. **Kubernetes stores none of it**
— pmm-managed has no k8s client and writes no label, annotation or Lease. Two
independent read paths off the same Raft state:

| Surface | Source |
| --- | --- |
| `/v1/ha/nodes` | `raftNode.LeaderWithID()` — cluster-wide view |
| `pmm_ha_leader_status` | `raftNode.State() == raft.Leader` — each node's local view |

`pmm_ha_*` metrics (from `managed/services/ha/ha_metrics.go`, HA mode only):

| Metric | Meaning |
| --- | --- |
| `pmm_ha_leader_status{node_id}` | 1 on the leader, 0 on followers; once converged, `sum()` of 0 = no leader and >1 = split-brain — mid-failover scrapes transiently show either, so wait for `waitForLeaderStatusSum(1)` before classifying |
| `pmm_ha_raft_term{node_id}` | Raft term; rapid growth = leader flapping |
| `pmm_ha_up{node_id,role}` | 1 per live node, `role` is `voter`/`nonvoter` |

## Logs

pmm-managed logs to **`/srv/logs/pmm-managed.log`**, not container stdout —
`kubectl logs` shows supervisord. Read them with:

```bash
kubectl exec -n pmm pmm-ha-0 -c pmm-ha -- \
  sh -c "grep -a 'I am the leader!' /srv/logs/pmm-managed.log | tail -1"
```

Promotions log `I am the leader!` at Info. Demotions (`I am not a leader!`) fire
only on a clean transition, so a pod killed while leading never writes one — and
because `/srv` is a PVC, its stale promotion outlives the restart.

## Useful checks

```bash
kubectl get pods -n pmm -l app.kubernetes.io/component=pmm-server
curl -sk -u admin:$PW "$PMM_URL/v1/ha/status"          # {"status":"Enabled"}
curl -sk -u admin:$PW "$PMM_URL/v1/ha/nodes"           # node_name / role / status
```

`/v1/ha/nodes` also carries `expected_nodes`, which the UI uses to grade badge
health: all alive = Healthy, ~1/3 down = Degraded, ~2/3 = Critical. Expect
**Degraded** briefly after a failover — do not assert Healthy across one.
