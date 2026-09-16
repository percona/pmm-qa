#!/usr/bin/env bash
# One-shot snapshot of the checks PMM-15262 asks for after each experiment.
#
#   ./observe.sh "BASELINE"
#
# run-experiments.sh calls the same helpers itself; this is for reading the
# cluster by hand, between or outside experiments.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1
. ./lib.sh

LABEL="${1:-snapshot}"
echo "===================== $LABEL @ $(date -u +%H:%M:%SZ) ====================="

echo "--- pods not Running/Completed in $PMM_NS"
kubectl get pods -n "$PMM_NS" --no-headers 2>/dev/null \
  | awk '$3!="Running" && $3!="Completed" {print "   ", $1, $2, $3, "restarts="$4, "age="$5}' \
  || echo "    (query failed)"

echo "--- PMM Server replicas"
kubectl get pods -n "$PMM_NS" -l app.kubernetes.io/component=pmm-server --no-headers 2>/dev/null \
  | awk '{print "   ", $1, $2, $3, "restarts="$4, "age="$5}'

echo "--- Raft leadership (200 = leader, 400 = follower)"
for p in $(pmm_pods); do
  code="$(kubectl exec -n "$PMM_NS" "$p" -c pmm-ha --request-timeout=10s -- bash -c \
    'curl -s -m5 -u "admin:$PMM_ADMIN_PASSWORD" -o /dev/null -w "%{http_code}" \
     http://127.0.0.1:8080/v1/server/leaderHealthCheck' 2>/dev/null)" || code="unreachable"
  echo "    $p -> ${code:-unreachable}"
done
echo "    leader: $(pmm_leader || echo 'NONE — HAProxy has no backend, expect 503')"

echo "--- PMM UI through HAProxy"
echo "    /graph/login: $(ui_status)"

echo "--- metrics"
echo "    targets up : $(vm_query 'count(up==1)')"
echo "    targets down: $(vm_query 'count(up==0)')"
echo "    ingest/s   : $(vm_query 'sum(rate(vm_rows_inserted_total[5m]))')"

# Resolved fresh every time: Patroni fails over, and a demoted primary reports a
# near-empty pool that looks like the problem has gone away.
echo "--- PostgreSQL (primary: $(pg_primary))"
echo "    in use / limit : $(pg_q "SELECT count(*)||' / '||current_setting('max_connections') FROM pg_stat_activity;")"
echo "    free (of 97)   : $(pg_free_slots)"
echo "    by client      :"
pg_q "SELECT '      '||coalesce(client_addr::text,'local')||'  '||usename||'  '||count(*)
      FROM pg_stat_activity WHERE usename IN ('gfuser','pmmuser') GROUP BY 1,2 ORDER BY count(*) DESC;"
echo
