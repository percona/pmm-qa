# Chaos Mesh on PMM HA — PMM-15262

Chaos experiments against a PMM HA cluster on LKE. Chaos Mesh runs in its own
`chaos-mesh` namespace; PMM stays in `pmm`.

## Install

```bash
helm repo add chaos-mesh https://charts.chaos-mesh.org --force-update
kubectl create namespace chaos-mesh
helm install chaos-mesh chaos-mesh/chaos-mesh -n chaos-mesh --version 2.8.4 \
  -f k8s/chaos-mesh/values.yaml --timeout 10m --wait
```

`values.yaml` overrides the chart's default docker socket — LKE nodes run
containerd, and without the override every injection fails at the daemon.

Blast radius is fenced by `enableFilterNamespace: true`: injection only reaches
namespaces carrying the annotation, so nothing touches `kube-system`.

```bash
kubectl annotate ns pmm chaos-mesh.org/inject=enabled --overwrite
```

## Dashboard

`securityMode` is on, so the UI needs a service-account token. Port-forward
rather than exposing a LoadBalancer — this is a chaos control plane.

```bash
kubectl apply -f k8s/chaos-mesh/rbac-dashboard.yaml
kubectl create token chaos-manager -n chaos-mesh --duration=24h
kubectl port-forward -n chaos-mesh svc/chaos-dashboard 2333:2333   # http://localhost:2333
```

## Running an experiment

```bash
./k8s/chaos-mesh/observe.sh "BASELINE"
kubectl apply -f k8s/chaos-mesh/experiments/podchaos-pmm-server.yaml
./k8s/chaos-mesh/observe.sh "T+30s"
kubectl delete -f k8s/chaos-mesh/experiments/podchaos-pmm-server.yaml
```

`observe.sh` captures the checks PMM-15262 asks for after each experiment: pod
state, which replica holds Raft leadership, UI reachability through HAProxy, and
scrape-target/ingest counts.

## Selector safety

Experiments select PMM Server pods on `app.kubernetes.io/component=pmm-server`.
The ClickHouse Keeper pods do not carry that label, so they are excluded by
construction rather than by an exclusion list that a later edit could drop.

This matters on the cluster this was developed against: the PVC
`keeper-data-volume-pmm-ha-keeper-keeper-0-1-0` was already mid-deletion, held
only by the `pvc-protection` finalizer on its running pod. Killing that Keeper
finalizes the PVC and the pod returns with an empty volume — data loss caused by
the experiment, indistinguishable from a chaos finding. Check for PVCs pending
deletion before any PodChaos round:

```bash
kubectl get pvc -A -o json | jq -r '.items[]|select(.metadata.deletionTimestamp)|"\(.metadata.namespace)/\(.metadata.name)"'
```
