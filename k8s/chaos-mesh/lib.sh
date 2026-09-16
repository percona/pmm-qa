#!/usr/bin/env bash
# Shared helpers for the PMM HA chaos scripts. Sourced, not executed.
#
# Everything here resolves cluster identity at call time rather than taking it
# as a constant. Leadership moves between experiments, and PostgreSQL fails
# over; both caught us out during PMM-15262, the second one silently — readings
# taken against a demoted primary showed 8 connections where the live figure
# was 91.

PMM_NS="${PMM_NS:-pmm}"
CHAOS_NS="${CHAOS_NS:-chaos-mesh}"

c_red=$'\033[31m'; c_grn=$'\033[32m'; c_yel=$'\033[33m'; c_dim=$'\033[2m'; c_off=$'\033[0m'
say()  { printf '%s\n' "$*"; }
info() { printf '%s==>%s %s\n' "$c_dim" "$c_off" "$*"; }
ok()   { printf '%s  ok%s  %s\n' "$c_grn" "$c_off" "$*"; }
warn() { printf '%s warn%s %s\n' "$c_yel" "$c_off" "$*"; }
die()  { printf '%s fail%s %s\n' "$c_red" "$c_off" "$*" >&2; exit 1; }

need() { command -v "$1" >/dev/null || die "$1 not found in PATH"; }

# --- identity resolution -----------------------------------------------------

pmm_pods() {
  kubectl get pods -n "$PMM_NS" -l app.kubernetes.io/component=pmm-server \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null | grep . | sort
}

# Prints the pod currently holding Raft leadership, or nothing.
pmm_leader() {
  local p
  for p in $(pmm_pods); do
    if [ "$(kubectl exec -n "$PMM_NS" "$p" -c pmm-ha --request-timeout=15s -- bash -c \
         'curl -s -m5 -o /dev/null -w "%{http_code}" -u "admin:$PMM_ADMIN_PASSWORD" \
          http://127.0.0.1:8080/v1/server/leaderHealthCheck' 2>/dev/null)" = "200" ]; then
      printf '%s' "$p"; return 0
    fi
  done
  return 1
}

# A pod that is NOT the leader. StressChaos and PodChaos target one of these so a
# spurious failover cannot muddy the result.
pmm_follower() {
  local leader p
  leader="$(pmm_leader || true)"
  for p in $(pmm_pods); do
    [ "$p" = "$leader" ] || { printf '%s' "$p"; return 0; }
  done
  return 1
}

# The CURRENT PostgreSQL primary. Never hardcode this.
pg_primary() {
  kubectl get pods -n "$PMM_NS" -l postgres-operator.crunchydata.com/role=master \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null
}

pg_q() {  # pg_q "<sql>"  -> tuples-only, unaligned
  local pg; pg="$(pg_primary)"
  [ -n "$pg" ] || { echo "NO-PRIMARY"; return 1; }
  kubectl exec -n "$PMM_NS" "$pg" -c database --request-timeout=25s -- \
    psql -U postgres -t -A -c "$1" 2>/dev/null
}

pg_free_slots() { pg_q "SELECT 97 - count(*) FROM pg_stat_activity;" | tr -d ' '; }

# A pod outside the PMM Server set, used to probe the UI through HAProxy.
probe_pod() {
  kubectl get pods -n "$PMM_NS" -l app.kubernetes.io/name=vmselect \
    -o jsonpath='{.items[0].metadata.name}' 2>/dev/null
}

ui_status() {
  local probe; probe="$(probe_pod)"
  [ -n "$probe" ] || { echo "no-probe-pod"; return 1; }
  kubectl exec -n "$PMM_NS" "$probe" --request-timeout=20s -- sh -c \
    'wget -S -T8 --no-check-certificate -O /dev/null https://pmm-ha-haproxy.'"$PMM_NS"'.svc/graph/login 2>&1 \
     | grep -m1 -oE "HTTP/1.1 [0-9]+"' 2>/dev/null || echo "unreachable"
}

vm_query() {  # vm_query "<promql>" -> scalar
  local probe; probe="$(probe_pod)"
  kubectl exec -n "$PMM_NS" "$probe" --request-timeout=20s -- sh -c \
    "wget -qO- -T10 'http://127.0.0.1:8481/select/0/prometheus/api/v1/query?query=$1'" 2>/dev/null \
    | sed -n 's/.*"value":\[[0-9.]*,"\([0-9.]*\)"\].*/\1/p'
}

# --- chaos lifecycle ---------------------------------------------------------

# Chaos Mesh will not re-run a completed object: it sits in desiredPhase Stop and
# `kubectl apply` silently no-ops, keeping the old duration. Always recreate.
chaos_create() {  # chaos_create <file> <kind> <name>
  kubectl delete "$2" "$3" -n "$CHAOS_NS" --ignore-not-found >/dev/null 2>&1
  sleep 3
  kubectl create -f "$1" >/dev/null || die "could not create $3"
}

chaos_delete() { kubectl delete "$1" "$2" -n "$CHAOS_NS" --ignore-not-found >/dev/null 2>&1; }

chaos_injected() {  # true when the CR claims injection — necessary, NOT sufficient
  [ "$(kubectl get "$1" "$2" -n "$CHAOS_NS" \
       -o jsonpath='{.status.conditions[?(@.type=="AllInjected")].status}' 2>/dev/null)" = "True" ]
}

chaos_wait_recovered() {  # chaos_wait_recovered <kind> <name> <timeout-s>
  local deadline=$(( $(date +%s) + ${3:-600} ))
  while [ "$(kubectl get "$1" "$2" -n "$CHAOS_NS" \
             -o jsonpath='{.status.conditions[?(@.type=="AllRecovered")].status}' 2>/dev/null)" != "True" ]; do
    [ "$(date +%s)" -lt "$deadline" ] || { warn "$2 did not report recovery before the deadline"; return 1; }
    sleep 10
  done
}

# Render a manifest with its pod-name selector repointed at $2. Writes to a temp
# copy — the tracked manifest is never edited, so a run cannot leave the repo
# holding whichever pod happened to be a follower that day.
render_for_pod() {  # render_for_pod <manifest> <pod> -> prints temp path
  local out; out="$(mktemp -t chaos-XXXXXX.yaml)"
  sed "s|statefulset.kubernetes.io/pod-name: .*|statefulset.kubernetes.io/pod-name: $2|" "$1" >"$out"
  printf '%s' "$out"
}

# --- probes used to prove a fault actually landed ----------------------------
# Chaos Mesh reported AllInjected: True four times during PMM-15262 while doing
# nothing, and once while destroying a volume mount. Every experiment must prove
# itself with a measurement, not a status field.

# Milliseconds to open a TCP connection from a PMM pod to a host:port.
connect_ms() {  # connect_ms <pmm-pod> <host:port>
  kubectl exec -n "$PMM_NS" "$1" -c pmm-ha --request-timeout=30s -- bash -c \
    "curl -s -o /dev/null -m 10 -w '%{time_connect}' telnet://$2" 2>/dev/null \
    | awk '{printf "%d", $1*1000}'
}

# Percentage of one core used by a pod's cgroup over 5 seconds (100 = one core).
cpu_pct() {  # cpu_pct <pmm-pod>
  kubectl exec -n "$PMM_NS" "$1" -c pmm-ha --request-timeout=30s -- bash -c \
    'a=$(grep ^usage_usec /sys/fs/cgroup/cpu.stat | awk "{print \$2}"); sleep 5
     b=$(grep ^usage_usec /sys/fs/cgroup/cpu.stat | awk "{print \$2}"); echo $(( (b-a)/50000 ))' 2>/dev/null
}

mem_mib() {  # mem_mib <pmm-pod>
  kubectl exec -n "$PMM_NS" "$1" -c pmm-ha --request-timeout=25s -- bash -c \
    'echo $(( $(cat /sys/fs/cgroup/memory.current)/1024/1024 ))' 2>/dev/null
}

oom_kills() {
  kubectl exec -n "$PMM_NS" "$1" -c pmm-ha --request-timeout=25s -- bash -c \
    'grep -E "^oom_kill " /sys/fs/cgroup/memory.events | awk "{print \$2}"' 2>/dev/null
}
