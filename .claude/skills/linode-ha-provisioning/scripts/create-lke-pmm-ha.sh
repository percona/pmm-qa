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
K8S_VERSION="${K8S_VERSION:-1.33}"
NODE_TYPE="${NODE_TYPE:-g6-standard-4}"
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
    --tags "$RUN_ID"

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
kubectl wait --for=condition=Ready nodes --all --timeout=300s
kubectl get nodes

# --- dependencies (operators) ------------------------------------------------
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

if [[ "$DEPS_CHART" == percona/* || "$PMM_CHART" == percona/* ]]; then
    helm repo add "$HELM_REPO_NAME" "$HELM_REPO_URL" --force-update
    helm repo update
fi

deps_args=(); [ -n "$CHART_VERSION" ] && deps_args+=(--version "$CHART_VERSION")
[ -n "$DEPS_VALUES" ] && deps_args+=(-f "$DEPS_VALUES")
[ -n "$DEPS_SET" ] && deps_args+=(--set "$DEPS_SET")

log "Installing PMM HA dependencies from $DEPS_CHART"
helm install pmm-operators "$DEPS_CHART" --namespace "$NAMESPACE" "${deps_args[@]}"

for op in victoria-metrics-operator altinity-clickhouse-operator pg-operator; do
    log "Waiting for operator: $op"
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

log "Waiting for HAProxy front end (up to 15m)..."
until kubectl get pods -n "$NAMESPACE" -o name | grep -q pmm-ha-haproxy; do sleep 10; done
kubectl wait --for=condition=ready \
    "$(kubectl get pods -n "$NAMESPACE" -o name | grep pmm-ha-haproxy)" \
    -n "$NAMESPACE" --timeout=15m
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

# --- persist run artifacts ---------------------------------------------------
{
    echo "cluster_label=$CLUSTER_LABEL"
    echo "cluster_id=$CLUSTER_ID"
    echo "expires_epoch=$EXPIRES_EPOCH"
    echo "external_ip=$EXTERNAL_IP"
    echo "url=https://$EXTERNAL_IP"
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
