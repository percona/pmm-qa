#!/usr/bin/env bash
# Install Chaos Mesh against a PMM HA cluster and verify it can actually inject.
#
#   ./k8s/chaos-mesh/setup.sh              install and verify
#   ./k8s/chaos-mesh/setup.sh --uninstall  remove everything this created
#
# Assumes KUBECONFIG already points at the cluster.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1
. ./lib.sh

CHART_VERSION="${CHART_VERSION:-2.8.4}"

uninstall() {
  info "removing Chaos Mesh"
  kubectl delete networkchaos,podchaos,stresschaos,iochaos,dnschaos,timechaos \
    --all -n "$CHAOS_NS" --ignore-not-found >/dev/null 2>&1 || true
  helm uninstall chaos-mesh -n "$CHAOS_NS" >/dev/null 2>&1 || true
  kubectl delete -f rbac-dashboard.yaml --ignore-not-found >/dev/null 2>&1 || true
  kubectl annotate ns "$PMM_NS" chaos-mesh.org/inject- >/dev/null 2>&1 || true
  kubectl delete ns "$CHAOS_NS" --ignore-not-found >/dev/null 2>&1 || true
  ok "removed. PMM namespace untouched."
  exit 0
}
[ "${1:-}" = "--uninstall" ] && uninstall

need kubectl; need helm

info "checking the PMM cluster is healthy before installing"
kubectl get ns "$PMM_NS" >/dev/null 2>&1 || die "namespace $PMM_NS not found"
pods="$(pmm_pods)"; [ -n "$pods" ] || die "no PMM Server pods found in $PMM_NS"
not_ready="$(kubectl get pods -n "$PMM_NS" -l app.kubernetes.io/component=pmm-server \
  --no-headers 2>/dev/null | awk '$2!="1/1"{print $1}')"
[ -z "$not_ready" ] || die "these PMM pods are not Ready: $not_ready"
ok "PMM Server pods Ready: $(echo "$pods" | tr '\n' ' ')"

info "installing Chaos Mesh $CHART_VERSION into $CHAOS_NS"
helm repo add chaos-mesh https://charts.chaos-mesh.org --force-update >/dev/null
helm repo update chaos-mesh >/dev/null
kubectl create ns "$CHAOS_NS" --dry-run=client -o yaml | kubectl apply -f - >/dev/null
helm upgrade --install chaos-mesh chaos-mesh/chaos-mesh \
  --namespace "$CHAOS_NS" --version "$CHART_VERSION" \
  -f values.yaml --timeout 10m --wait >/dev/null
ok "Chaos Mesh installed"

# values.yaml sets enableFilterNamespace, so injection only reaches namespaces
# carrying this annotation. Without it every experiment is a silent no-op.
kubectl annotate ns "$PMM_NS" chaos-mesh.org/inject=enabled --overwrite >/dev/null
ok "namespace $PMM_NS annotated for injection"

kubectl apply -f rbac-dashboard.yaml >/dev/null
ok "dashboard RBAC applied"

info "verifying the daemons picked up the containerd runtime"
# The chart defaults to the docker socket. On containerd nodes that default makes
# every injection fail while still reporting success, so this is worth asserting.
sleep 5
if kubectl logs -n "$CHAOS_NS" -l app.kubernetes.io/component=chaos-daemon --tail=200 2>/dev/null \
   | grep -q '"runtime": "containerd"'; then
  ok "chaos-daemon running with containerd"
else
  warn "could not confirm containerd in the daemon logs — check values.yaml matches the node runtime:"
  warn "  kubectl get nodes -o jsonpath='{.items[0].status.nodeInfo.containerRuntimeVersion}'"
fi

if kubectl logs -n "$CHAOS_NS" -l app.kubernetes.io/component=chaos-daemon --tail=200 2>/dev/null \
   | grep -q 'fail to find device cgroup'; then
  warn "/dev/fuse device-cgroup error present — IOChaos will NOT work on these nodes."
  warn "It fails destructively (detaches the target's volume). run-experiments.sh skips it by default."
fi

cat <<EOF

$(ok "setup complete")

Dashboard:
  kubectl create token chaos-manager -n $CHAOS_NS --duration=24h
  kubectl port-forward -n $CHAOS_NS svc/chaos-dashboard 2333:2333
  open http://localhost:2333  and paste the token

Run the experiments:
  ./k8s/chaos-mesh/run-experiments.sh --list
  ./k8s/chaos-mesh/run-experiments.sh
EOF
