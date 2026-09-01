#!/usr/bin/env bash
# Install PMM-HA into two namespaces of one cluster, per the PMM-15149 / PMM-15151 docs:
# the dependencies chart goes in ONCE (its operators are cluster-wide), then one pmm-ha
# release per namespace, each with a distinct release name.
set -euo pipefail

CHARTS=${CHARTS:-/tmp/percona-helm-charts}
NS1=${NS1:-pmm} NS2=${NS2:-pmm-dr}
REL1=${REL1:-pmm-ha} REL2=${REL2:-pmm-dr}
IMAGE_REPO=${IMAGE_REPO:-perconalab/pmm-server}
IMAGE_TAG=${IMAGE_TAG:-3-dev-latest}
HERE=$(cd "$(dirname "$0")" && pwd)

# REL2 deliberately does not contain the chart name, so pmm.fullname becomes
# "$REL2-pmm-ha" -- the case PMM-15151 fixes in PMM_HA_PEERS and the HAProxy init script.
make_secret() {
  local ns=$1 admin=$2
  kubectl get namespace "$ns" >/dev/null 2>&1 || kubectl create namespace "$ns"
  kubectl get secret pmm-secret -n "$ns" >/dev/null 2>&1 && return
  kubectl create secret generic pmm-secret -n "$ns" \
    --from-literal=PMM_ADMIN_PASSWORD="$admin" \
    --from-literal=PMM_CLICKHOUSE_USER=clickhouse_pmm \
    --from-literal=PMM_CLICKHOUSE_PASSWORD="$(openssl rand -base64 18)" \
    --from-literal=VMAGENT_remoteWrite_basicAuth_username=victoriametrics_pmm \
    --from-literal=VMAGENT_remoteWrite_basicAuth_password="$(openssl rand -base64 18)" \
    --from-literal=PG_PASSWORD="$(openssl rand -base64 18)" \
    --from-literal=GF_PASSWORD="$(openssl rand -base64 18)"
}

make_secret "$NS1" "${ADMIN_PASSWORD_1:?set ADMIN_PASSWORD_1}"
make_secret "$NS2" "${ADMIN_PASSWORD_2:?set ADMIN_PASSWORD_2}"

# Operators: once per cluster. An install that predates PMM-15151 is namespace-scoped and
# must be upgraded in place under its own release name -- often the older "pmm-operators".
DEPS_REL=$(helm list -n "$NS1" -o json | jq -r '.[]|select(.chart|test("^pmm-ha-dependencies-"))|.name' | head -1)
if [ -n "$DEPS_REL" ]; then
  helm upgrade "$DEPS_REL" "$CHARTS/charts/pmm-ha-dependencies" -n "$NS1"
else
  helm install pmm-ha-operators "$CHARTS/charts/pmm-ha-dependencies" -n "$NS1"
fi
for n in pg-operator altinity-clickhouse-operator victoria-metrics-operator; do
  # rollout status, not `kubectl wait`: pg/ClickHouse operators use strategy Recreate, so
  # the pre-upgrade pod is still Ready (merely Terminating) when helm returns.
  kubectl rollout status deployment -l "app.kubernetes.io/name=$n" -n "$NS1" --timeout=300s
done

helm upgrade --install "$REL1" "$CHARTS/charts/pmm-ha" -n "$NS1" \
  --set "image.repository=$IMAGE_REPO,image.tag=$IMAGE_TAG"
helm upgrade --install "$REL2" "$CHARTS/charts/pmm-ha" -n "$NS2" \
  -f "$HERE/values-second-namespace.yaml" \
  --set "image.repository=$IMAGE_REPO,image.tag=$IMAGE_TAG"

kubectl rollout status "statefulset/$REL1" -n "$NS1" --timeout=30m
kubectl rollout status "statefulset/$REL2-pmm-ha" -n "$NS2" --timeout=30m
