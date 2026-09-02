#!/usr/bin/env bash
# Reproduce D3: `helm upgrade` of a pmm-ha release intermittently fails with
#
#   Error: UPGRADE FAILED: pre-upgrade hooks failed: warning: Hook pre-upgrade
#   pmm-ha/templates/pg-user-credentials-secrets.yaml failed: 1 error occurred:
#       * secrets "pmmuser-credentials" already exists
#
# because gfuser-credentials / pmmuser-credentials have two owners: the chart creates them as
# pre-install,pre-upgrade Helm hooks, and pg-db.users[].secretName hands the same two names to
# the Percona PG operator. Helm's hook policy defaults to before-hook-creation, so every upgrade
# DELETES and recreates both secrets; when PGO's reconcile lands between Helm's delete and
# Helm's create, Helm's create returns AlreadyExists.
#
# Measured ~10% of upgrades (4 in 40). It is transient -- retrying succeeds -- so a single
# upgrade usually looks fine. Run this to see it.
#
# Usage: KUBECONFIG=... ./repro-d3-hook-race.sh [namespace] [release] [attempts]
set -uo pipefail

NS=${1:-pmm}
REL=${2:-pmm-ha}
ATTEMPTS=${3:-40}
CHARTS=${CHARTS:-/tmp/percona-helm-charts}

command -v helm >/dev/null || { echo "helm not found" >&2; exit 1; }
helm status "$REL" -n "$NS" >/dev/null 2>&1 || { echo "no release '$REL' in namespace '$NS'" >&2; exit 1; }

echo "== the two owners of the same object =="
kubectl get perconapgcluster -n "$NS" -o jsonpath='{range .items[0].spec.users[*]}  PGO user {.name} -> secretName {.secretName}{"\n"}{end}'
grep -m2 -A1 '"helm.sh/hook"' "$CHARTS/charts/pmm-ha/templates/pg-user-credentials-secrets.yaml" 2>/dev/null \
  | sed 's/^/  chart: /'

echo
echo "== Helm recreates them on every upgrade (creationTimestamp advances) =="
before=$(kubectl get secret pmmuser-credentials -n "$NS" -o jsonpath='{.metadata.creationTimestamp}')
helm upgrade "$REL" "$CHARTS/charts/pmm-ha" -n "$NS" --reuse-values >/dev/null 2>&1
after=$(kubectl get secret pmmuser-credentials -n "$NS" -o jsonpath='{.metadata.creationTimestamp}')
echo "  pmmuser-credentials : $before -> $after"
echo "  pmm-secret (normal release resource, for contrast) : $(kubectl get secret pmm-secret -n "$NS" -o jsonpath='{.metadata.creationTimestamp}')"

echo
echo "== hammer the upgrade until the race is lost (up to $ATTEMPTS attempts) =="
fails=0
for i in $(seq 1 "$ATTEMPTS"); do
  out=$(helm upgrade "$REL" "$CHARTS/charts/pmm-ha" -n "$NS" --reuse-values 2>&1)
  if grep -q "UPGRADE FAILED" <<<"$out"; then
    fails=$((fails + 1))
    echo "  attempt $i: FAILED"
    grep -oE 'secrets "[^"]+" already exists' <<<"$out" | sed 's/^/    /'
    # PGO won the race: the object it left behind is stamped as its own, not Helm's.
    kubectl get secret gfuser-credentials pmmuser-credentials -n "$NS" \
      -o custom-columns='SECRET:.metadata.name,MANAGED-BY:.metadata.labels.app\.kubernetes\.io/managed-by,HELM-OWNER:.metadata.annotations.meta\.helm\.sh/release-name' \
      | sed 's/^/    /'
    echo "    -> retrying immediately (expected to succeed):"
    helm upgrade "$REL" "$CHARTS/charts/pmm-ha" -n "$NS" --reuse-values 2>&1 | head -1 | sed 's/^/       /'
  else
    echo "  attempt $i: ok"
  fi
done

echo
echo "== result: $fails failure(s) in $ATTEMPTS upgrades =="
echo "release status: $(helm list -n "$NS" -o json | jq -r --arg r "$REL" '.[]|select(.name==$r)|.status')"
