#!/usr/bin/env bash
# PMM-15262 — capture the ticket's validation checks at one point in time.
# usage: observe.sh <label>
set -uo pipefail
LABEL="${1:-snapshot}"
echo "===================== $LABEL @ $(date -u +%H:%M:%SZ) ====================="

echo "--- pods not Running/Completed"
kubectl get pods -n pmm --no-headers 2>/dev/null \
  | awk '$3!="Running" && $3!="Completed" {print "   ", $1, $2, $3, "restarts="$4, "age="$5}' \
  || echo "    (query failed)"
echo "--- pmm-ha replicas"
kubectl get pods -n pmm -l app.kubernetes.io/component=pmm-server --no-headers 2>/dev/null \
  | awk '{print "   ", $1, $2, $3, "restarts="$4, "age="$5}'

echo "--- leader (200 = leader)"
for p in pmm-ha-0 pmm-ha-1 pmm-ha-2; do
  code=$(kubectl exec -n pmm "$p" -c pmm-ha --request-timeout=10s -- \
    bash -c 'curl -s -m 5 -u "admin:$PMM_ADMIN_PASSWORD" -o /dev/null -w "%{http_code}" \
    http://127.0.0.1:8080/v1/server/leaderHealthCheck' 2>/dev/null) || code="unreachable"
  echo "    $p -> $code"
done

echo "--- PMM UI via HAProxy (from vmselect pod)"
kubectl exec -n pmm vmselect-pmm-ha-vmcluster-0 --request-timeout=15s -- \
  sh -c 'wget -q -T5 --no-check-certificate -O /dev/null "https://pmm-ha-haproxy.pmm.svc/graph/login" 2>&1 && echo "    graph/login: OK" || echo "    graph/login: FAIL"' 2>/dev/null \
  || echo "    graph/login: probe failed"

echo "--- metrics: targets up / down / samples ingested (5m)"
kubectl exec -n pmm vmselect-pmm-ha-vmcluster-0 --request-timeout=20s -- sh -c '
  q() { wget -qO- -T10 "http://127.0.0.1:8481/select/0/prometheus/api/v1/query?query=$1" 2>/dev/null; }
  echo -n "    up==1      : "; q "count(up==1)"      | sed -n "s/.*\"value\":\[[0-9.]*,\"\([0-9.]*\)\"\].*/\1/p"
  echo -n "    up==0      : "; q "count(up==0)"      | sed -n "s/.*\"value\":\[[0-9.]*,\"\([0-9.]*\)\"\].*/\1/p"
  echo -n "    ingest/s   : "; q "sum(rate(vm_rows_inserted_total[5m]))" | sed -n "s/.*\"value\":\[[0-9.]*,\"\([0-9.]*\)\"\].*/\1/p"
' 2>/dev/null || echo "    (vmselect probe failed)"
echo
