#!/bin/bash
# Provision a throwaway LKE cluster and install PMM in HA mode via Helm.
# Derived from the PMM-14744 prototype (k8s/createLKE_install_PMM_HA.sh), made
# generic and CI-friendly: parameterised cluster/region/nodes, custom-chart and
# Feature-Build support, real readiness polling instead of fixed sleeps, and a
# run directory that captures everything needed to reach and tear down the run.
#
# Everything is overridable by env var; sane defaults let it run with none.
# Docs: .claude/skills/linode-ha-provisioning/SKILL.md

set -euo pipefail

# --- configuration (all overridable) ----------------------------------------
RUN_ID="${RUN_ID:-$(date +%Y%m%d-%H%M%S)}"
CLUSTER_LABEL="${CLUSTER_LABEL:-pmm-ha-${RUN_ID}}"
REGION="${REGION:-us-east}"
K8S_VERSION="${K8S_VERSION:-}"         # resolved to the latest LKE offers below if unset (versions roll)
NODE_TYPE="${NODE_TYPE:-g6-standard-6}"  # 16GB/6vCPU — 8GB/4vCPU (standard-4) starves the 3-replica HA stack (pods stay Pending)
NODE_COUNT="${NODE_COUNT:-3}"          # >=3 keeps a Raft quorum with one node down
NAMESPACE="${NAMESPACE:-pmm}"

# TTL / self-destruct backstop. An LKE cluster has no on-box timer, so the
# cluster's own tags carry its expiry: the relay reaper deletes any
# `pmm-qa-ephemeral` cluster whose `expires-<epoch>` tag is in the past, even if
# teardown is never called. EXPIRES_EPOCH is set by the relay; standalone runs
# derive it from TTL_HOURS so the reaper still reaps a hand-run cluster.
TTL_HOURS="${TTL_HOURS:-24}"
EXPIRES_EPOCH="${EXPIRES_EPOCH:-$(( $(date +%s) + TTL_HOURS * 3600 ))}"

# PMM admin password: env, first arg, or generated.
PMM_PW="${PMM_PW:-${1:-$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)}}"

# Helm sources. Point DEPS_CHART / PMM_CHART at a local path or a custom repo to
# install from Feature-Build charts; pass DEPS_SET / PMM_SET (comma-separated
# key=value) or DEPS_VALUES / PMM_VALUES (a values.yaml path) to override images
# for an FB. The exact image key depends on the chart version -- read its
# values.yaml; do not assume one here.
HELM_REPO_NAME="${HELM_REPO_NAME:-percona}"
HELM_REPO_URL="${HELM_REPO_URL:-https://percona.github.io/percona-helm-charts/}"
DEPS_CHART="${DEPS_CHART:-percona/pmm-ha-dependencies}"
PMM_CHART="${PMM_CHART:-percona/pmm-ha}"
CHART_VERSION="${CHART_VERSION:-}"     # optional --version for both charts
DEPS_VALUES="${DEPS_VALUES:-}"
PMM_VALUES="${PMM_VALUES:-}"
DEPS_SET="${DEPS_SET:-}"
PMM_SET="${PMM_SET:-}"

RUN_DIR="${RUN_DIR:-/tmp/pmm-ha/${RUN_ID}}"
mkdir -p "$RUN_DIR"
KUBECONFIG_FILE="$RUN_DIR/kubeconfig.yaml"

log() { echo "[pmm-ha] $*"; }

# --- prerequisites -----------------------------------------------------------
for cmd in linode-cli jq kubectl helm base64 openssl; do
    command -v "$cmd" >/dev/null 2>&1 || { echo "ERROR: '$cmd' is not installed." >&2; exit 1; }
done
# One knob: LINODE_TOKEN (LKE Read/Write). linode-cli reads it as LINODE_CLI_TOKEN.
[ -n "${LINODE_TOKEN:-}" ] || { echo "ERROR: set LINODE_TOKEN (Linode API token, LKE Read/Write)." >&2; exit 1; }
export LINODE_CLI_TOKEN="$LINODE_TOKEN"

# LKE only offers a rolling window of k8s versions (e.g. 1.33 was retired) and a
# create with a retired one 400s. Pin via K8S_VERSION, else take the latest the
# API currently offers.
if [ -z "$K8S_VERSION" ]; then
    K8S_VERSION=$(linode-cli lke versions-list --json | jq -r '.[].id' | sort -V | tail -n1)
    [ -n "$K8S_VERSION" ] && [ "$K8S_VERSION" != "null" ] || { echo "ERROR: could not resolve an LKE k8s version." >&2; exit 1; }
    log "Resolved latest LKE k8s version: $K8S_VERSION"
fi

# --- create the cluster ------------------------------------------------------
log "Creating LKE cluster '$CLUSTER_LABEL' ($NODE_COUNT x $NODE_TYPE, $REGION, k8s $K8S_VERSION)"
linode-cli lke cluster-create \
    --label "$CLUSTER_LABEL" \
    --region "$REGION" \
    --k8s_version "$K8S_VERSION" \
    --node_pools.type "$NODE_TYPE" \
    --node_pools.count "$NODE_COUNT" \
    --tags pmm-qa-ephemeral \
    --tags "expires-${EXPIRES_EPOCH}" \
    --tags "pmm-qa-run:$RUN_ID"

log "Resolving cluster ID..."
CLUSTER_ID=""
until [ -n "$CLUSTER_ID" ] && [ "$CLUSTER_ID" != "null" ]; do
    CLUSTER_ID=$(linode-cli lke clusters-list --json \
        | jq -r --arg l "$CLUSTER_LABEL" '.[] | select(.label == $l) | .id')
    [ -n "$CLUSTER_ID" ] && [ "$CLUSTER_ID" != "null" ] || { sleep 10; CLUSTER_ID=""; }
done
echo "$CLUSTER_ID" >"$RUN_DIR/cluster_id"
log "Cluster ID: $CLUSTER_ID (saved to $RUN_DIR/cluster_id)"

log "Waiting for all $NODE_COUNT nodes to become ready..."
until [ "$(linode-cli lke pools-list "$CLUSTER_ID" --json \
        | jq '[.[].nodes[] | select(.status == "ready")] | length')" -eq "$NODE_COUNT" ]; do
    sleep 15
done
log "All nodes ready."

# --- kubeconfig --------------------------------------------------------------
until linode-cli lke kubeconfig-view "$CLUSTER_ID" --json \
        | jq -r '.[0].kubeconfig' | base64 --decode >"$KUBECONFIG_FILE" 2>/dev/null \
        && [ -s "$KUBECONFIG_FILE" ]; do
    sleep 10
done
export KUBECONFIG="$KUBECONFIG_FILE"
log "KUBECONFIG: $KUBECONFIG"
# Always capture pod state on exit (success OR failure) so a stuck bring-up is
# debuggable from the run dir without the cluster still being alive.
_diag() {
    kubectl get pods -n "$NAMESPACE" -o wide >"$RUN_DIR/pods.txt" 2>&1 || true
    kubectl get events -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp >"$RUN_DIR/events.txt" 2>&1 || true
    kubectl describe pods -n "$NAMESPACE" >"$RUN_DIR/describe.txt" 2>&1 || true
}
# Stamp this cluster's volumes with pmm-qa-run:<id> so teardown
# (prune-lke-orphans.sh) can attribute them. Runs on every exit path via the trap
# so a failed bring-up is tagged too. Best-effort. destroy-lke / the reaper tag
# again right before deleting the cluster, catching volumes created after this.
_tag_for_teardown() {
    [ -n "${CLUSTER_ID:-}" ] || return 0
    local SD; SD="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    LINODE_TOKEN="$LINODE_TOKEN" bash "$SD/tag-lke-resources.sh" "$CLUSTER_ID" "$RUN_ID" || true
}
trap '_diag; _tag_for_teardown' EXIT
# Linode reports the pool "ready" before the nodes register with the k8s API
# server, so `kubectl wait --all` would hit an empty list and fail immediately
# ("no matching resources found"). Wait for the nodes to appear first, then wait
# for Ready.
log "Waiting for $NODE_COUNT node(s) to register with the API server..."
until [ "$(kubectl get nodes --no-headers 2>/dev/null | grep -c .)" -ge "$NODE_COUNT" ]; do sleep 10; done
kubectl wait --for=condition=Ready nodes --all --timeout=300s
kubectl get nodes

# --- storage class: tag every CSI volume at birth ----------------------------
# LKE's default SC has no volumeTags and a StorageClass's parameters are immutable,
# so its volumes are born untagged and prune-lke-orphans.sh can never attribute them.
# `replace --force` recreates it in one step (a plain apply would hit "parameters
# forbidden"); non-fatal with one retry so losing a race with LKE's addon reconciler
# degrades to an untagged volume (imperative tagging backstop) -- never a failed
# provision that leaks the already-created cluster.
_apply_tagged_sc() {
    kubectl replace --force -f - <<EOF
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: linode-block-storage-retain
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: linodebs.csi.linode.com
parameters:
  linodebs.csi.linode.com/volumeTags: "pmm-qa-ephemeral,pmm-qa-run:$RUN_ID"
reclaimPolicy: Retain
volumeBindingMode: Immediate
allowVolumeExpansion: true
EOF
}
_apply_tagged_sc || { sleep 3; _apply_tagged_sc || log "WARN: tagged StorageClass not applied; volumes fall back to imperative tagging"; }

# --- dependencies (operators) ------------------------------------------------
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

if [[ "$DEPS_CHART" == percona/* || "$PMM_CHART" == percona/* ]]; then
    helm repo add "$HELM_REPO_NAME" "$HELM_REPO_URL" --force-update
    helm repo update
fi

# Make the chart version explicit in the log. An unset CHART_VERSION installs the
# LATEST published chart -- correct for "latest" runs, wrong for a specific
# release/RC/FB. Surface which chart actually gets deployed so a run that forgot to
# pin is visible in the log tail (the relay returns it), not silently mismatched.
if [ -n "$CHART_VERSION" ]; then
    log "Chart version pinned: $CHART_VERSION ($PMM_CHART, $DEPS_CHART)"
else
    log "WARNING: no CHART_VERSION set -- installing LATEST $PMM_CHART / $DEPS_CHART. Pin chart_version when testing a specific release/RC/FB."
    if [[ "$PMM_CHART" == percona/* ]]; then
        log "Latest available: $(helm search repo "$PMM_CHART" -o json 2>/dev/null | jq -r '.[0] | "chart \(.version) → appVersion \(.app_version)"' 2>/dev/null || echo '?')"
    fi
fi

deps_args=(); [ -n "$CHART_VERSION" ] && deps_args+=(--version "$CHART_VERSION")
[ -n "$DEPS_VALUES" ] && deps_args+=(-f "$DEPS_VALUES")
[ -n "$DEPS_SET" ] && deps_args+=(--set "$DEPS_SET")

log "Installing PMM HA dependencies from $DEPS_CHART"
helm install pmm-operators "$DEPS_CHART" --namespace "$NAMESPACE" "${deps_args[@]}"

for op in victoria-metrics-operator altinity-clickhouse-operator pg-operator; do
    log "Waiting for operator: $op"
    # Same empty-match race: the pod may not exist the instant helm returns, and
    # `kubectl wait -l` errors on zero matches. Wait for it to appear, then Ready.
    until kubectl get pod -l "app.kubernetes.io/name=$op" -n "$NAMESPACE" --no-headers 2>/dev/null | grep -q .; do sleep 5; done
    kubectl wait --for=condition=ready pod \
        -l "app.kubernetes.io/name=$op" -n "$NAMESPACE" --timeout=300s
done
log "Dependencies installed."

# --- secret ------------------------------------------------------------------
PG_PW=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
GF_PW=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
CH_PW=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
VM_PW=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)

kubectl create secret generic pmm-secret --namespace "$NAMESPACE" \
    --dry-run=client -o yaml \
    --from-literal=PMM_ADMIN_PASSWORD="$PMM_PW" \
    --from-literal=PMM_CLICKHOUSE_USER="clickhouse_pmm" \
    --from-literal=PMM_CLICKHOUSE_PASSWORD="$CH_PW" \
    --from-literal=VMAGENT_remoteWrite_basicAuth_username="victoriametrics_pmm" \
    --from-literal=VMAGENT_remoteWrite_basicAuth_password="$VM_PW" \
    --from-literal=PG_PASSWORD="$PG_PW" \
    --from-literal=GF_PASSWORD="$GF_PW" | kubectl apply -f -
log "Secret pmm-secret created."

# --- PMM HA ------------------------------------------------------------------
pmm_args=(); [ -n "$CHART_VERSION" ] && pmm_args+=(--version "$CHART_VERSION")
[ -n "$PMM_VALUES" ] && pmm_args+=(-f "$PMM_VALUES")
[ -n "$PMM_SET" ] && pmm_args+=(--set "$PMM_SET")

log "Installing PMM HA from $PMM_CHART"
helm install pmm-ha "$PMM_CHART" --namespace "$NAMESPACE" "${pmm_args[@]}"

# HAProxy fronts the PMM server, and its readiness gate depends on the backend
# PMM pods coming up first — so wait for the PMM server StatefulSet to be Ready
# before waiting on HAProxy, which both sequences the bring-up and makes a stuck
# backend show up as a backend timeout (clearer than an opaque HAProxy timeout).
# Wait for the PMM server StatefulSet to FULLY roll out before HAProxy. `rollout
# status` blocks until readyReplicas == spec.replicas, so it covers the complete
# expected replica set — not a one-time pod snapshot that can miss replicas
# created later — and fails (set -e) on timeout, so a degraded cluster is never
# published as ready. The EXIT trap has already captured pods/describe.
log "Waiting for the PMM server StatefulSet to appear (up to 5m)..."
pmm_sts=""
pmm_appear_deadline=$(( $(date +%s) + 300 ))
until pmm_sts="$(kubectl get statefulset -n "$NAMESPACE" -o name | grep -E '/pmm-ha$|/pmm-ha-server$' | head -1)"; [ -n "$pmm_sts" ]; do
    [ "$(date +%s)" -lt "$pmm_appear_deadline" ] || { echo "ERROR: PMM server StatefulSet never appeared within 5m" >&2; exit 1; }
    sleep 10
done
log "Waiting for $pmm_sts to roll out (all replicas Ready, up to 20m)..."
kubectl rollout status "$pmm_sts" -n "$NAMESPACE" --timeout=20m

log "Waiting for HAProxy front end (up to 20m)..."
haproxy_deadline=$(( $(date +%s) + 900 ))
until kubectl get pods -n "$NAMESPACE" -o name | grep -q pmm-ha-haproxy; do
    [ "$(date +%s)" -lt "$haproxy_deadline" ] || { echo "ERROR: pmm-ha-haproxy pods never appeared within 15m" >&2; exit 1; }
    sleep 10
done
# HA runs more than one HAProxy replica; leave the substitution UNQUOTED so each
# pod name is a separate arg to kubectl wait (a quoted blob is one bad resource name).
# shellcheck disable=SC2046
kubectl wait --for=condition=ready \
    $(kubectl get pods -n "$NAMESPACE" -o name | grep pmm-ha-haproxy) \
    -n "$NAMESPACE" --timeout=20m
kubectl get pods -n "$NAMESPACE"

# --- external access ---------------------------------------------------------
kubectl patch svc pmm-ha-haproxy -n "$NAMESPACE" \
    -p '{"spec":{"type":"LoadBalancer"}}'
log "Waiting for LoadBalancer external IP..."
EXTERNAL_IP=""
until [ -n "$EXTERNAL_IP" ]; do
    EXTERNAL_IP=$(kubectl get svc pmm-ha-haproxy -n "$NAMESPACE" \
        -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    [ -n "$EXTERNAL_IP" ] || sleep 15
done

# --- PMM actually serving? (not just pods Ready) -----------------------------
# Pods Ready doesn't guarantee the HTTP front end is reachable end-to-end (LB
# wiring, HAProxy backends). This box (the relay) reaches the public LB IP
# directly — no egress proxy here — so confirm PMM answers over the LoadBalancer
# before publishing the run as ready. Fail the build (set -e) if it never does,
# so the relay never reports `ready` for a cluster whose UI can't be opened.
# Require an exact 200 — `curl -f` treats 3xx as success, so a redirect could
# otherwise pass this gate without PMM actually serving. Check %{http_code}.
log "Verifying PMM returns 200 from https://$EXTERNAL_IP/v1/readyz (up to 10m)..."
pmm_up_deadline=$(( $(date +%s) + 600 ))
until [ "$(curl -k -sS -m 10 -o /dev/null -w '%{http_code}' "https://$EXTERNAL_IP/v1/readyz" 2>/dev/null)" = "200" ]; do
    [ "$(date +%s)" -lt "$pmm_up_deadline" ] || { echo "ERROR: PMM did not return 200 from /v1/readyz on the LB within 10m" >&2; exit 1; }
    sleep 10
done
log "PMM is serving (/v1/readyz 200)."
# (volumes + NodeBalancer are tagged for teardown attribution by the EXIT trap,
# so failed bring-ups are covered too -- see _tag_for_teardown above.)

# --- persist run artifacts ---------------------------------------------------
{
    echo "cluster_label=$CLUSTER_LABEL"
    echo "cluster_id=$CLUSTER_ID"
    echo "expires_epoch=$EXPIRES_EPOCH"
    echo "external_ip=$EXTERNAL_IP"
    # The QA session reaches PMM through the agent egress proxy, which refuses raw-IP
    # HTTPS but allows Linode's per-IP rDNS hostname. Hand back the hostname URL so
    # the UI is actually openable (curl/Playwright still need -k / ignoreHTTPSErrors
    # for PMM's self-signed cert).
    echo "external_host=$(echo "$EXTERNAL_IP" | tr '.' '-').ip.linodeusercontent.com"
    echo "url=https://$(echo "$EXTERNAL_IP" | tr '.' '-').ip.linodeusercontent.com"
    echo "pmm_admin_password=$PMM_PW"
    echo "postgres_password=$PG_PW"
    echo "grafana_password=$GF_PW"
    echo "clickhouse_password=$CH_PW"
    echo "victoriametrics_password=$VM_PW"
} >"$RUN_DIR/summary.env"
chmod 600 "$RUN_DIR/summary.env"

kubectl get pods -n "$NAMESPACE" -o wide >"$RUN_DIR/pods.txt" || true
kubectl get events -n "$NAMESPACE" --sort-by=.metadata.creationTimestamp \
    >"$RUN_DIR/events.txt" || true

cat <<EOF

======================= PMM HA READY =======================
 URL        : https://$EXTERNAL_IP   (admin / see summary.env)
 Cluster    : $CLUSTER_LABEL (id $CLUSTER_ID)
 Kubeconfig : $KUBECONFIG_FILE
 Run dir    : $RUN_DIR  (summary.env, pods.txt, events.txt)

 TEARDOWN (mandatory -- LKE clusters bill by the hour):
   linode-cli lke cluster-delete $CLUSTER_ID
 Backstop: tagged expires-$EXPIRES_EPOCH ($(date -u -d "@$EXPIRES_EPOCH" 2>/dev/null || date -u -r "$EXPIRES_EPOCH" 2>/dev/null)) --
   the relay reaper deletes it after that even if teardown is skipped.
============================================================
EOF
