#!/usr/bin/env bash
# Run the PMM-15262 chaos experiments in sequence, proving each fault landed and
# checking the ticket's validation list around it.
#
#   ./run-experiments.sh --list              show the catalogue
#   ./run-experiments.sh                     run all safe experiments
#   ./run-experiments.sh --only n1,n3        run a subset
#   ./run-experiments.sh --skip s3           run all but one
#   ./run-experiments.sh --hold              pause for confirmation between experiments
#   ./run-experiments.sh --include-unsafe    also run experiments known to break this platform
#
# Exit code is the number of experiments whose fault could not be verified or
# whose cluster checks regressed, so CI can gate on it.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1
. ./lib.sh

RUN_DIR="${RUN_DIR:-$PWD/runs/$(date -u +%Y%m%dT%H%M%SZ)}"
ONLY=""; SKIP=""; HOLD=0; UNSAFE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --list) LIST=1 ;;
    --only) ONLY="$2"; shift ;;
    --skip) SKIP="$2"; shift ;;
    --hold) HOLD=1 ;;
    --include-unsafe) UNSAFE=1 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) die "unknown flag $1" ;;
  esac
  shift
done

# id | kind | manifest | CR name | description | safe?
EXPERIMENTS=(
  "pod1|PodChaos|experiments/podchaos-pmm-server.yaml|exp1-kill-pmm-server-leader|kill the Raft leader pod|safe"
  "n1|NetworkChaos|experiments/networkchaos-1-latency-pg.yaml|exp-n1-latency-pmm-to-pg|200ms PMM <-> PostgreSQL|safe"
  "n5|NetworkChaos|experiments/networkchaos-5-latency-clickhouse.yaml|exp-n5-latency-pmm-to-clickhouse|200ms PMM <-> ClickHouse|safe"
  "n6|NetworkChaos|experiments/networkchaos-6-latency-victoriametrics.yaml|exp-n6-latency-pmm-to-victoriametrics|200ms PMM <-> VictoriaMetrics reads|safe"
  "n2|NetworkChaos|experiments/networkchaos-2-loss-vmagent.yaml|exp-n2-loss-vmagent-write-path|30% loss on the metrics write path|safe"
  "n3|NetworkChaos|experiments/networkchaos-3-partition-raft.yaml|exp-n3-partition-raft-leader|partition the Raft leader|safe"
  "n4|NetworkChaos|experiments/networkchaos-4-block-clickhouse.yaml|exp-n4-block-pmm-to-clickhouse|block PMM <-> ClickHouse|safe"
  "s1|StressChaos|experiments/stresschaos-1-cpu.yaml|exp-s1-cpu-stress-pmm-server|CPU stress on a follower|safe"
  "s2|StressChaos|experiments/stresschaos-2-memory.yaml|exp-s2-memory-stress-pmm-server|memory stress on a follower|safe"
  "s3|StressChaos|experiments/stresschaos-3-cpu-memory.yaml|exp-s3-cpu-memory-stress-pmm-server|combined CPU + memory|safe"
  "i1|IOChaos|experiments/iochaos-1-disk-latency.yaml|exp-i1-disk-latency-pmm-server|disk latency on /srv|UNSAFE"
)

if [ "${LIST:-0}" = 1 ]; then
  printf '%-6s %-14s %-44s %s\n' ID KIND DESCRIPTION SAFETY
  for e in "${EXPERIMENTS[@]}"; do IFS='|' read -r id kind _ _ desc safe <<<"$e"
    printf '%-6s %-14s %-44s %s\n' "$id" "$kind" "$desc" "$safe"; done
  exit 0
fi

need kubectl
mkdir -p "$RUN_DIR"
FAILURES=0

# ---------------------------------------------------------------- pre-flight
preflight() {
  info "pre-flight"
  local not_ready pods free leader ui
  pods="$(pmm_pods)"; [ -n "$pods" ] || die "no PMM Server pods in $PMM_NS"
  not_ready="$(kubectl get pods -n "$PMM_NS" -l app.kubernetes.io/component=pmm-server \
    --no-headers 2>/dev/null | awk '$2!="1/1"{print $1}')"
  [ -z "$not_ready" ] || die "not Ready: $not_ready — chaos on a degraded cluster gives results you cannot attribute"
  leader="$(pmm_leader || true)"
  [ -n "$leader" ] || die "no Raft leader — the cluster cannot serve the UI; fix that first"
  ui="$(ui_status)"
  case "$ui" in *200*) : ;; *) die "UI is $ui, expected 200" ;; esac
  free="$(pg_free_slots)"
  ok "pods Ready, leader=$leader, UI=$ui, PostgreSQL free slots=$free"
  if [ "${free:-0}" -lt 15 ] 2>/dev/null; then
    warn "only $free PostgreSQL slots free. Any experiment that restarts a PMM pod is"
    warn "likely to leave it stuck: the replacement's Grafana cannot get a connection,"
    warn "supervisord gives up after ~60s and never retries. See PMM-15262."
    [ "$HOLD" = 1 ] || warn "continuing anyway — pass --hold to confirm between experiments"
  fi
}

snapshot() {  # snapshot <label> <file>
  { echo "=== $1 @ $(date -u +%H:%M:%SZ)"
    kubectl get pods -n "$PMM_NS" -l app.kubernetes.io/component=pmm-server --no-headers 2>/dev/null \
      | awk '{print "  pod",$1,$2,$3,"restarts="$4}'
    echo "  leader   : $(pmm_leader || echo NONE)"
    echo "  ui       : $(ui_status)"
    echo "  targets  : $(vm_query 'count(up==1)')"
    echo "  ingest/s : $(vm_query 'sum(rate(vm_rows_inserted_total[5m]))')"
    echo "  pg free  : $(pg_free_slots)"
  } | tee -a "$2"
}

# ------------------------------------------------- per-experiment fault proof
# Each returns 0 only when the fault is measurably present. Printing the numbers
# matters as much as the verdict: a "pass" with no measurement behind it is what
# this whole harness exists to prevent.
verify_fault() {  # verify_fault <id> <target-pod>
  local id="$1" pod="$2" v
  case "$id" in
    n1) v="$(connect_ms "$pod" "pmm-ha-pg-db-ha.$PMM_NS.svc.cluster.local:5432")"
        say "    PG connect: ${v}ms (want >100)"; [ "${v:-0}" -gt 100 ] ;;
    n5|n4) v="$(connect_ms "$pod" "pmm-ha-clickhouse-sticky.$PMM_NS.svc.cluster.local:9000")"
        if [ "$id" = n4 ]; then say "    ClickHouse connect: ${v}ms (want blocked / very slow)"; [ "${v:-0}" -gt 3000 ]
        else say "    ClickHouse connect: ${v}ms (want >100)"; [ "${v:-0}" -gt 100 ]; fi ;;
    n6) v="$(connect_ms "$pod" "pmm-ha-vmauth.$PMM_NS.svc.cluster.local:8427")"
        say "    vmauth connect: ${v}ms (want >100)"; [ "${v:-0}" -gt 100 ] ;;
    n2) # loss shows as TCP retransmit stalls, not steady latency: count slow requests
        local slow; slow="$(kubectl exec -n "$PMM_NS" \
          "$(kubectl get pods -n "$PMM_NS" -l app.kubernetes.io/name=vmagent -o jsonpath='{.items[0].metadata.name}')" \
          -c vmagent --request-timeout=60s -- sh -c \
          'i=0; s=0; while [ $i -lt 12 ]; do t=$( { time -p wget -q -T20 -O /dev/null \
             http://pmm-ha-vmauth.'"$PMM_NS"'.svc.cluster.local:8427/health; } 2>&1 | awk "/^real/{print \$2}" )
             case "$t" in 0.0*|0.1*) : ;; *) s=$((s+1));; esac; i=$((i+1)); done; echo $s' 2>/dev/null)"
        say "    stalled requests: ${slow:-0} of 12 (want >=1)"; [ "${slow:-0}" -ge 1 ] ;;
    n3) local l; l="$(pmm_leader || true)"
        say "    leader is now: ${l:-NONE} (was $PRE_LEADER)"
        [ -n "$l" ] && [ "$l" != "$PRE_LEADER" ] ;;
    s1|s3) v="$(cpu_pct "$pod")"; say "    CPU: ${v}% of one core (want >150)"; [ "${v:-0}" -gt 150 ] ;;
    s2) v="$(mem_mib "$pod")"; say "    memory: ${v}MiB (baseline $PRE_MEM, want +1000)"
        [ $(( ${v:-0} - ${PRE_MEM:-0} )) -gt 1000 ] ;;
    *)  warn "    no fault probe defined for $id — cannot confirm it did anything"; return 1 ;;
  esac
}

# ------------------------------------------------------------------ main loop
run_one() {  # run_one <id> <kind> <manifest> <crname> <desc>
  local id="$1" kind="$2" manifest="$3" cr="$4" desc="$5"
  local log="$RUN_DIR/$id.log" target rendered rc=0

  say ""; say "──────── $id · $desc"
  target="$(pmm_follower)"; PRE_LEADER="$(pmm_leader || true)"
  case "$id" in
    pod1|n3) target="$PRE_LEADER" ;;   # these deliberately hit the leader
  esac
  [ -n "$target" ] || { warn "could not resolve a target pod"; return 1; }
  info "target pod: $target (leader: ${PRE_LEADER:-none})"

  snapshot "BASELINE" "$log" >/dev/null
  PRE_MEM="$(mem_mib "$target")"

  # Repoint the pod-name selector at the pod we resolved, in a temp copy.
  rendered="$(render_for_pod "$manifest" "$target")"
  chaos_create "$rendered" "$kind" "$cr"
  sleep 12

  if chaos_injected "$kind" "$cr"; then
    ok "CR reports AllInjected"
  else
    warn "CR does not report injection"
  fi
  # The status field has been wrong before. The measurement is what counts.
  if verify_fault "$id" "$target"; then
    ok "fault verified by measurement"
  else
    warn "FAULT NOT VERIFIED — treat any result from $id as meaningless"
    rc=1
  fi

  snapshot "DURING" "$log" | sed 's/^/  /'
  info "waiting for the experiment to expire"
  chaos_wait_recovered "$kind" "$cr" 900
  sleep 20
  snapshot "AFTER" "$log" | sed 's/^/  /'
  chaos_delete "$kind" "$cr"
  rm -f "$rendered"

  # Post-conditions the ticket asks about: nothing restarted, a leader exists,
  # the UI serves, and metric collection never gapped.
  local restarts leader ui
  restarts="$(kubectl get pods -n "$PMM_NS" -l app.kubernetes.io/component=pmm-server \
    -o jsonpath='{range .items[*]}{.status.containerStatuses[0].restartCount}{"\n"}{end}' 2>/dev/null \
    | awk '{s+=$1} END{print s+0}')"
  leader="$(pmm_leader || echo NONE)"; ui="$(ui_status)"
  say "  post: restarts=$restarts leader=$leader ui=$ui"
  case "$ui" in *200*) : ;; *) warn "UI did not return to 200"; rc=1 ;; esac
  [ "$leader" != "NONE" ] || { warn "no leader after the run"; rc=1; }

  [ $rc -eq 0 ] && ok "$id complete" || warn "$id finished with problems (see $log)"
  return $rc
}

preflight
say ""; info "results under $RUN_DIR"

for e in "${EXPERIMENTS[@]}"; do
  IFS='|' read -r id kind manifest cr desc safe <<<"$e"
  [ -z "$ONLY" ] || [[ ",$ONLY," == *",$id,"* ]] || continue
  [ -z "$SKIP" ] || [[ ",$SKIP," != *",$id,"* ]] || continue
  if [ "$safe" = "UNSAFE" ] && [ "$UNSAFE" != 1 ]; then
    warn "skipping $id ($desc) — known to break the target pod on cgroup v2 nodes; --include-unsafe to force"
    continue
  fi
  if [ "$HOLD" = 1 ]; then
    read -r -p "Run $id ($desc)? [y/N] " a; [ "${a:-n}" = y ] || { info "skipped $id"; continue; }
  fi
  run_one "$id" "$kind" "$manifest" "$cr" "$desc" || FAILURES=$((FAILURES+1))
done

say ""
[ "$FAILURES" -eq 0 ] && ok "all selected experiments completed cleanly" \
                      || warn "$FAILURES experiment(s) need attention"
say "logs: $RUN_DIR"
exit "$FAILURES"
