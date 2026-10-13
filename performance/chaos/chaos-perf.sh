#!/usr/bin/env bash
# PMM performance runs on CHAOS: one PMM Server (a VM, or an existing chaos-ha.sh cluster) and
# client VMs that each run K pmm-client containers, every container its own PMM node in push mode.
#   chaos-perf.sh up <run_id> [--nodes 300] [--per-vm 75] [--client-size 16/32] [--server-size 16/32/200]
#                             [--ha <chaos-ha run_id>] [--keep] [--days N] [--no-clone]
#                             [--server-image IMG] [--client-image IMG] [--pg-tables 100]
#   chaos-perf.sh run <run_id> --duration 1h [up options]   # up, hold, report, down; detached, survives the session
#   chaos-perf.sh report <run_id> [--since 2026-10-13T10:00:00Z] [--warmup 15m] [--window 10m]
#   chaos-perf.sh clients <run_id>        # (re)start the client containers on the run's VMs
#   chaos-perf.sh stats <run_id>          # docker stats and load per client VM
#   chaos-perf.sh upgrade <run_id>        # pull the newest images, recreate server and clients in place (soak)
#   chaos-perf.sh ssh <run_id> <vm> [cmd] # vm: srv, c01, c02, ...
#   chaos-perf.sh down <run_id> [--force]
#   chaos-perf.sh list
# Needs CHAOS_TOKEN. CHAOS_WAIT_MIN=N waits up to N minutes for a free slot under the token's instance limit. State lives in $CHAOS_RUNS_DIR/perf-<run_id> (default /srv/chaos-runs).
set -euo pipefail
umask 007

HERE=$(cd "$(dirname "$0")" && pwd)
API=https://chaos.int.percona.com/api/compute/proxmox-instances
if [ -z "${CHAOS_RUNS_DIR:-}" ] && [ -w /srv/chaos-runs ]; then RUNS=/srv/chaos-runs
else RUNS=${CHAOS_RUNS_DIR:-${CLAUDE_CONFIG_DIR:-$HOME/.claude}/chaos-runs}; fi
ME=${CCR_SESSION_ACCOUNT_EMAIL:-unknown}
DB_IMAGES="percona/percona-server:8.0 postgres:16 percona/percona-server-mongodb:7.0"

die() { echo "chaos-perf: $*" >&2; exit 1; }
log() { echo "[$(date -u +%FT%TZ)] $*"; }
api() { # method path [json] [extra curl args...]; CHAOS's error body (e.g. the instance limit) goes to stderr
  local out code
  out=$(curl -sS -m 60 -X "$1" -H "Authorization: Token $CHAOS_TOKEN" -H "Accept: application/json" \
    -H "Content-Type: application/json" "$API$2" ${3:+-d "$3"} -w '\n%{http_code}' "${@:4}") || return $?
  code=${out##*$'\n'}; out=${out%$'\n'*}
  if [ "$code" -ge 400 ]; then echo "CHAOS $1 $2: HTTP $code $out" >&2; return 22; fi
  [ -z "$out" ] || echo "$out"
}
pw() { openssl rand -base64 30 | tr -dc 'a-zA-Z0-9' | head -c 24; }
run_dir() {
  [[ "$1" =~ ^[A-Za-z0-9._-]{1,30}$ ]] || die "run_id must be 1-30 chars of [A-Za-z0-9._-]"
  echo "$RUNS/perf-$1"
}
need_run() { d=$(run_dir "$1"); [ -f "$d/params.json" ] || die "no perf run '$1' on this host (see: chaos-perf.sh list)"; }
param() { jq -r ".$1" "$d/params.json"; }
host_ip() { ip -4 -o addr show scope global | awk '{split($4,a,"/"); print a[1]}' | grep '^10\.30\.' | head -1; }
ssh_opts() {
  local k; k="${TMPDIR:-/tmp}/chaos-key-$(id -u)-$(basename "$d")"
  [ -f "$k" ] || install -m 600 "$d/key" "$k"
  echo "-i $k -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no -o LogLevel=ERROR -o ConnectTimeout=10 -o ServerAliveInterval=30 -o BatchMode=yes"
}
# shellcheck disable=SC2046
on() { local vm=$1; shift; ssh $(ssh_opts) "root@$(cat "$d/vms/$vm/ip")" "$@" </dev/null; }
# shellcheck disable=SC2046
on_stdin() { local vm=$1; shift; ssh $(ssh_opts) "root@$(cat "$d/vms/$vm/ip")" "$@"; }
# shellcheck disable=SC2046
put() { scp -q -r $(ssh_opts) "$2" "root@$(cat "$d/vms/$1/ip"):$3"; }
clients() { find "$d/vms" -mindepth 1 -maxdepth 1 -name 'c*' -printf '%f\n' 2>/dev/null | sort; }

user_data() { # extra images to pull
  cat <<EOF | base64 -w0
#cloud-config
disable_root: false
users:
  - name: root
    ssh_authorized_keys: ["$(cat "$d/key.pub")"]
package_update: true
packages: [jq, curl, sysstat]
runcmd:
  - command -v docker || curl -fsSL https://get.docker.com | sh
  - for i in $*; do for n in 1 2 3; do docker pull -q \$i && break; sleep 20; done; done
  - touch /root/.perf-ready
EOF
}

vm_create() { # name vcpu mem disk images...
  local name=$1 vcpu=$2 mem=$3 disk=$4; shift 4
  local host; host=$(printf 'pmmperf-%s-%s' "$(basename "$d" | cut -c6-)" "$name" | tr '[:upper:]._' '[:lower:]--' | cut -c1-50)
  local body; body=$(jq -n --arg h "$host" --argjson c "$vcpu" --argjson m "$mem" --argjson k "$disk" \
    --argjson days "$(param days)" --arg ud "$(user_data "$@")" --arg o "$ME" --arg r "$(basename "$d")" \
    '{hostname:$h, os:"Ubuntu 24.04", vcpu:$c, memory:$m, disk:$k, delete_after_days:$days,
      user_data:$ud, description:("pmm-qa perf " + $r + " for " + $o),
      tags:{Project:"pmm-qa-perf", Run:$r, Owner:$o}}')
  mkdir -p "$d/vms/$name"
  # The token's 20-instance limit is shared with everyone's QA VMs: wait for a slot, up to $CHAOS_WAIT_MIN.
  local id="" err end=$(( $(date +%s) + ${CHAOS_WAIT_MIN:-0} * 60 ))
  while :; do
    err=$(api POST / "$body" 2>&1 >"$d/vms/$name/create.json") && id=$(jq -re .identifier "$d/vms/$name/create.json") && break
    if [[ "$err" == *"maximum limit"* ]] && [ "$(date +%s)" -lt "$end" ]; then
      log "CHAOS instance limit reached; waiting for a free slot for $name"; sleep 120; continue
    fi
    rm -rf "${d:?}/vms/$name"; die "create $name failed: $err"
  done
  echo "$id" >"$d/vms/$name/id"; echo "$host" >"$d/vms/$name/hostname"
  log "created $name ($host, id $id, ${vcpu}c/${mem}G/${disk}G)"
}

vm_running() { # name: waits for running + ip, opens ssh from this host
  local name=$1 id; id=$(cat "$d/vms/$name/id")
  local r st="" ip=""
  for _ in $(seq 90); do
    r=$(api GET "/$id/") || r='{}'
    st=$(jq -r .status <<<"$r"); ip=$(jq -r '.ip_address // empty' <<<"$r")
    [ "$st" = running ] && [ -n "$ip" ] && break
    sleep 10
  done
  [ -n "$ip" ] && [ "$st" = running ] || die "$name ($id) not running after 15 min (status $st)"
  echo "$ip" >"$d/vms/$name/ip"
  fw_open "$name" "$(host_ip)/32" 22
}

fw_open() { # name source port
  api POST "/$(cat "$d/vms/$1/id")/firewall-rules/" \
    "$(jq -n --arg s "$2" --arg p "$3" '{source:$s, port:$p, protocol:"tcp", comment:"pmm-qa perf"}')" >/dev/null \
    || log "firewall rule $2:$3 on $1 not added (already there?)"
}

vm_ready() { # name: cloud-init done, docker up, images pulled
  local name=$1
  for _ in $(seq 120); do
    on "$name" 'cloud-init status --wait >/dev/null 2>&1; test -f /root/.perf-ready && docker info >/dev/null' 2>/dev/null && return 0
    sleep 10
  done
  die "$name not ready after 20 min"
}

vm_stop_wait() { local id; id=$(cat "$d/vms/$1/id")
  api POST "/$id/stop/" >/dev/null
  for _ in $(seq 60); do [ "$(api GET "/$id/" | jq -r .status)" = stopped ] && return 0; sleep 5; done
  die "$1 did not stop"
}

# The golden VM has Docker and every image; its clones skip the install and the Docker Hub pulls.
# machine-id is cleared first, or every clone asks DHCP with the same DUID and gets the same IP.
clone_golden() { # count
  local n=$1 gid; gid=$(cat "$d/vms/c01/id")
  on c01 'docker ps -aq | xargs -r docker rm -f >/dev/null; cloud-init clean --logs --machine-id; sync'
  vm_stop_wait c01
  local i name host
  for i in $(seq 2 $((n + 1))); do
    name=$(printf 'c%02d' "$i")
    host=$(sed "s/-c01\$/-$name/" "$d/vms/c01/hostname")
    mkdir -p "$d/vms/$name"
    local id; id=$(api POST "/$gid/clone/" "$(jq -n --arg h "$host" --argjson days "$(param days)" \
      '{hostname:$h, delete_after_days:$days}')" | jq -re '.identifier // .id') \
      || { rm -rf "$d/vms/$name"; api POST "/$gid/start/" >/dev/null || true; return 1; }
    echo "$id" >"$d/vms/$name/id"; echo "$host" >"$d/vms/$name/hostname"
    log "cloned c01 -> $name (id $id)"
  done
  api POST "/$gid/start/" >/dev/null
  for i in $(seq 2 $((n + 1))); do api POST "/$(cat "$d/vms/$(printf 'c%02d' "$i")/id")/start/" >/dev/null 2>&1 || true; done
}

server_up() {
  local img; img=$(param server_image)
  vm_create srv "$(param server_vcpu)" "$(param server_mem)" "$(param server_disk)" "$img"
  vm_running srv; fw_open srv "$(host_ip)/32" 443; vm_ready srv
  on srv "docker run -d --name pmm-server --restart always -p 443:8443 -v pmm-data:/srv $img >/dev/null"
  local ok=0
  for _ in $(seq 60); do
    [ "$(on srv 'curl -ks -o /dev/null -w "%{http_code}" https://127.0.0.1:443/v1/readyz')" = 200 ] && { ok=1; break; }
    sleep 10
  done
  [ "$ok" = 1 ] || die "PMM Server not ready"
  local admin; admin=$(pw)
  # stdin, not argv: this host is shared and ps shows every argv.
  on_stdin srv 'read -r p; docker exec pmm-server change-admin-password "$p" >/dev/null' <<<"$admin"
  printf 'ADMIN_PASSWORD=%s\n' "$admin" >"$d/admin.env"
  echo "https://$(cat "$d/vms/srv/ip")" >"$d/url"
  echo "$(cat "$d/vms/srv/ip"):443" >"$d/server_address"
  echo pmm-server >"$d/server_nodes"
  log "PMM Server ready: $(cat "$d/url") ($(on srv 'docker inspect -f "{{index .Config.Labels \"org.opencontainers.image.version\"}}" pmm-server' || true))"
}

server_ha() { # chaos-ha.sh run id
  local h="$RUNS/$1"
  [ -f "$h/ha" ] && [ -f "$h/url" ] && [ -f "$h/admin.env" ] || die "no READY chaos-ha.sh run '$1' on this host"
  cp "$h/admin.env" "$d/admin.env"; cp "$h/url" "$d/url"
  echo "${1}" >"$d/ha_run"
  echo "$(sed 's#^https://##' "$h/url"):443" >"$d/server_address"
  log "using HA cluster $1 at $(cat "$d/url")"
}

clients_start() {
  local per; per=$(param per_vm)
  local total; total=$(param nodes)
  local addr; addr=$(cat "$d/server_address")
  local i=0 vm count first=1 pids=() fail=0
  # shellcheck disable=SC1091
  . "$d/admin.env"
  for vm in $(clients); do
    count=$(( total - first + 1 < per ? total - first + 1 : per ))
    [ "$count" -gt 0 ] || break
    on "$vm" 'rm -rf /root/perf/client; mkdir -p /root/perf'
    put "$vm" "$HERE/client" /root/perf/
    on_stdin "$vm" 'umask 077; cat >/root/perf/run.env' <<EOF
PMM_AGENT_SERVER_ADDRESS=$addr
PMM_AGENT_SERVER_USERNAME=admin
PMM_AGENT_SERVER_PASSWORD=$ADMIN_PASSWORD
PMM_AGENT_SERVER_INSECURE_TLS=1
PMM_AGENT_SETUP_METRICS_MODE=push
DB_PASSWORD=$(cat "$d/db_password")
CLIENT_IMAGE=$(param client_image)
PG_TABLES=$(jq -r '.pg_tables // 100' "$d/params.json")
EOF
    on "$vm" "bash /root/perf/client/load.sh start $vm $count" & pids+=($!)
    first=$((first + count)); i=$((i + 1))
  done
  for p in "${pids[@]}"; do wait "$p" || fail=1; done
  [ "$fail" = 0 ] || die "starting clients failed on some VM"
  log "started $((first - 1)) client containers on $i VM(s)"
}

cmd_up() {
  local run_id=$1; shift
  local nodes=300 per=75 csize=16/32 ssize=16/32/200 ha="" keep=0 days=1 clone=1 ref=main pgt=100
  local simg=percona/pmm-server:3 cimg=percona/pmm-client:3
  while [ $# -gt 0 ]; do
    case $1 in
      --nodes) nodes=$2; shift 2 ;;
      --per-vm) per=$2; shift 2 ;;
      --client-size) csize=$2; shift 2 ;;
      --server-size) ssize=$2; shift 2 ;;
      --ha) ha=$2; shift 2 ;;
      --keep) keep=1; shift ;;
      --days) days=$2; shift 2 ;;
      --no-clone) clone=0; shift ;;
      --server-image) simg=$2; shift 2 ;;
      --client-image) cimg=$2; shift 2 ;;
      --ref) ref=$2; shift 2 ;;
      --pg-tables) pgt=$2; shift 2 ;;
      --duration) shift 2 ;;
      *) die "unknown option $1" ;;
    esac
  done
  : "${CHAOS_TOKEN:?CHAOS_TOKEN not set}"
  [[ "$nodes" =~ ^[0-9]+$ && "$per" =~ ^[0-9]+$ && "$per" -ge 1 ]] || die "--nodes/--per-vm must be numbers"
  # 0 = never expires: only an explicit --keep (the soak lane) gets it.
  [ "$keep" = 1 ] && days=0
  [ "$keep" = 1 ] || { [[ "$days" =~ ^[0-9]+$ ]] && [ "$days" -ge 1 ] && [ "$days" -le 30 ]; } || die "--days must be 1-30"
  IFS=/ read -r cv cm <<<"$csize"; IFS=/ read -r sv sm sk <<<"$ssize"
  [ -n "$(host_ip)" ] || die "no 10.30.x address: not on a CHAOS runner host"
  d=$(run_dir "$run_id")
  [ -e "$d" ] && die "perf run '$run_id' already exists ($(cat "$d/owner" 2>/dev/null))"
  mkdir -p "$d/vms"; echo "$ME" >"$d/owner"
  ssh-keygen -q -t ed25519 -N "" -C "pmm-qa perf $run_id" -f "$d/key"; chmod 640 "$d/key"
  pw >"$d/db_password"
  local vms=$(( (nodes + per - 1) / per ))
  jq -n --argjson n "$nodes" --argjson p "$per" --argjson vms "$vms" --argjson cv "$cv" --argjson cm "$cm" \
    --argjson sv "$sv" --argjson sm "$sm" --argjson sk "$sk" --arg ha "$ha" --argjson days "$days" \
    --arg si "$simg" --arg ci "$cimg" --arg ref "$ref" --argjson pgt "$pgt" \
    '{nodes:$n, per_vm:$p, client_vms:$vms, client_vcpu:$cv, client_mem:$cm, server_vcpu:$sv, server_mem:$sm,
      server_disk:$sk, ha:$ha, days:$days, server_image:$si, client_image:$ci, ref:$ref, pg_tables:$pgt}' >"$d/params.json"
  log "perf run $run_id: $nodes nodes, $vms client VM(s) x $per, client ${cv}c/${cm}G, server $([ -n "$ha" ] && echo "HA $ha" || echo "${sv}c/${sm}G/${sk}G"), expiry $([ "$days" = 0 ] && echo never || echo "$days day(s)")"

  local spid=""
  if [ -n "$ha" ]; then server_ha "$ha"; else server_up & spid=$!; fi
  # shellcheck disable=SC2086
  vm_create c01 "$cv" "$cm" 60 "$cimg" $DB_IMAGES
  vm_running c01; vm_ready c01
  if [ "$vms" -gt 1 ]; then
    if [ "$clone" = 1 ] && clone_golden $((vms - 1)); then :
    else
      log "cloning unavailable: creating the other client VMs from scratch"
      for i in $(seq 2 "$vms"); do
        name=$(printf 'c%02d' "$i"); [ -f "$d/vms/$name/id" ] && continue
        # shellcheck disable=SC2086
        vm_create "$name" "$cv" "$cm" 60 "$cimg" $DB_IMAGES
      done
    fi
    local pids=()
    for vm in $(clients); do [ "$vm" = c01 ] && continue; (vm_running "$vm"; vm_ready "$vm") & pids+=($!); done
    for p in "${pids[@]}"; do wait "$p" || true; done
    for vm in $(clients); do on "$vm" true 2>/dev/null || die "client VM $vm never came up"; done
  fi
  [ -z "$spid" ] || wait "$spid" || die "server bring-up failed"
  # Clients reach the server only on 443.
  if [ -z "$ha" ]; then for vm in $(clients); do fw_open srv "$(cat "$d/vms/$vm/ip")/32" 443; done; fi
  clients_start
  date -u +%FT%TZ >"$d/load_started"
  log "UP: $(cat "$d/url") (admin password in $d/admin.env)"
}

# (Re)start the client containers: after a failed up, or with more VMs added by hand.
cmd_clients() { need_run "$1"
  if [ -d "$d/vms/srv" ]; then for vm in $(clients); do fw_open srv "$(cat "$d/vms/$vm/ip")/32" 443; done; fi
  clients_start
  [ -f "$d/load_started" ] || date -u +%FT%TZ >"$d/load_started"
}

cmd_stats() { need_run "$1"
  for vm in $(clients); do
    echo "== $vm"
    on "$vm" 'bash /root/perf/client/load.sh stats' || echo "(unreachable)"
  done
  if [ -d "$d/vms/srv" ]; then
    echo "== srv"
    on srv 'nproc; free -m | sed -n 2p; vmstat 5 3 | tail -2; docker stats --no-stream --format "{{.Name}} {{.CPUPerc}} {{.MemUsage}}"; df -h /var/lib/docker | tail -1'
  fi
}

cmd_upgrade() { need_run "$1"
  local simg cimg; simg=$(param server_image); cimg=$(param client_image)
  if [ -d "$d/vms/srv" ]; then
    on srv "docker pull -q $simg >/dev/null && docker rm -f pmm-server >/dev/null && docker run -d --name pmm-server --restart always -p 443:8443 -v pmm-data:/srv $simg >/dev/null"
    log "server recreated from $simg"
  fi
  for vm in $(clients); do on "$vm" "bash /root/perf/client/load.sh upgrade" & done
  wait
  log "clients upgraded to $cimg"
}

cmd_report() { need_run "$1"; shift; bash "$HERE/report.sh" "$d" "$@"; }

cmd_ssh() { need_run "$1"; local vm=$2; shift 2
  [ -f "$d/vms/$vm/ip" ] || die "no VM $vm in this run"
  # shellcheck disable=SC2046
  exec ssh $(ssh_opts) "root@$(cat "$d/vms/$vm/ip")" "$@"
}

cmd_down() { need_run "$1"
  [ "$(cat "$d/owner")" = "$ME" ] || [ "${2:-}" = --force ] || die "run '$1' belongs to $(cat "$d/owner")"
  local vm id code fail=0
  for vm in "$d"/vms/*/; do
    [ -d "$vm" ] || continue; vm=$(basename "$vm")
    [ -f "$d/vms/$vm/id" ] || { rm -rf "${d:?}/vms/$vm"; continue; }
    id=$(cat "$d/vms/$vm/id")
    # CHAOS answers DELETE of an already-deleted id with 500: gone means DELETE ok or GET 404.
    if api DELETE "/$id/terminate/" >/dev/null 2>&1 \
       || { code=$(api GET "/$id/" "" -o /dev/null -w '%{http_code}' 2>/dev/null || true); [ "$code" = 404 ]; }; then
      rm -rf "${d:?}/vms/$vm"; log "terminated $vm ($id)"
    else
      fail=1; log "terminate failed for $vm ($id); state kept for a retry"
    fi
  done
  [ "$fail" = 0 ] || die "some VMs were not terminated; run down again"
  [ -f "$d/ha_run" ] && log "HA cluster $(cat "$d/ha_run") is chaos-ha.sh's: tear it down there"
  mkdir -p "$RUNS/perf-reports"; cp "$d"/report*.json "$d"/run.log "$RUNS/perf-reports/" 2>/dev/null || true
  rm -rf "$d"; log "run $1 removed"
}

cmd_list() {
  for r in "$RUNS"/perf-*/; do
    [ -f "$r/params.json" ] || continue
    echo "$(basename "$r" | cut -c6-)  $(cat "$r/url" 2>/dev/null || echo -)  $(ls "$r/vms" 2>/dev/null | wc -l) VM(s)  $(cat "$r/owner")  $(jq -c '{nodes,per_vm,ha,days}' "$r/params.json")"
  done
}

# The whole fixed-length run, detached from the calling shell: a released session must not
# leave VMs behind, so teardown runs on every exit path here, not in the caller.
cmd_run() {
  local run_id=$1; shift
  local dur="" a=("$@")
  while [ $# -gt 0 ]; do case $1 in --duration) dur=$2; shift 2 ;; *) shift ;; esac; done
  [[ "$dur" =~ ^[0-9]+[smh]$ ]] || die "--duration like 90m or 3h is required"
  d=$(run_dir "$run_id"); [ -e "$d" ] && die "perf run '$run_id' already exists"
  mkdir -p "$RUNS/perf-logs"
  local logf="$RUNS/perf-logs/$run_id.log"
  setsid nohup bash "$0" _run "$run_id" "${a[@]}" >"$logf" 2>&1 </dev/null &
  echo "run $run_id started in the background (pid $!); log: $logf"
  echo "follow: tail -f $logf   (the run ends with RUN DONE or RUN FAILED)"
}

cmd__run() {
  local run_id=$1; shift
  local dur="" a=()
  while [ $# -gt 0 ]; do case $1 in --duration) dur=$2; shift 2 ;; *) a+=("$1"); shift ;; esac; done
  local secs; case $dur in *h) secs=$(( ${dur%h} * 3600 )) ;; *m) secs=$(( ${dur%m} * 60 )) ;; *s) secs=${dur%s} ;; esac
  d=$(run_dir "$run_id")
  # Global, not local: run_exit runs from the EXIT trap, after this function has returned.
  logf="$RUNS/perf-logs/$run_id.log"; RUN_ID=$run_id
  export CHAOS_WAIT_MIN=${CHAOS_WAIT_MIN:-60}
  run_exit() {
    local rc=$?; trap - EXIT TERM INT HUP
    if [ -f "$d/params.json" ]; then
      cp "$logf" "$d/run.log" 2>/dev/null || true
      bash "$0" down "$RUN_ID" || log "TEARDOWN FAILED: run chaos-perf.sh down $RUN_ID"
    fi
    if [ "$rc" = 0 ]; then echo "RUN DONE"; else echo "RUN FAILED rc=$rc"; fi
  }
  trap run_exit EXIT
  trap 'exit 143' TERM; trap 'exit 130' INT; trap 'exit 129' HUP
  bash "$0" up "$run_id" "${a[@]}"
  local end=$(( $(date +%s) + secs )) n=0
  log "holding load for $dur"
  while [ "$(date +%s)" -lt "$end" ]; do
    sleep 300; n=$((n + 1))
    [ $((n % 3)) = 1 ] && bash "$0" stats "$run_id" >"$d/stats-$(date -u +%H%M).txt" 2>&1 || true
  done
  bash "$0" stats "$run_id" >"$d/stats-final.txt" 2>&1 || true
  bash "$0" report "$run_id" || log "report failed"
  mkdir -p "$RUNS/perf-reports"; cp "$d"/stats-*.txt "$RUNS/perf-reports/" 2>/dev/null || true
  for f in "$d"/stats-*.txt; do mv "$RUNS/perf-reports/$(basename "$f")" "$RUNS/perf-reports/$run_id-$(basename "$f")" 2>/dev/null || true; done
}

case "${1:-}" in
  up|run|_run|clients|report|stats|upgrade|ssh|down) c=$1; shift; [ $# -ge 1 ] || die "usage: $c <run_id> ..."; "cmd_$c" "$@" ;;
  list) cmd_list ;;
  *) sed -n '2,16p' "$0"; exit 2 ;;
esac
