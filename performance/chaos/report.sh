#!/usr/bin/env bash
# Run report for a chaos-perf.sh run, from PMM's own metrics and QAN API.
#   report.sh <run_dir> [--since <ISO time>] [--warmup 15m] [--window 10m] [--lane scale|ha|soak]
# Writes <run_dir>/report-<UTC time>.json in the performance/ci/publish_report.sh schema and prints a summary.
# A run whose server CPU steal averages above 5% is marked invalid: CHAOS is shared hardware.
set -euo pipefail

d=${1:?usage: report.sh <run_dir> [options]}; shift
since=$(cat "$d/load_started" 2>/dev/null || true) warmup=15m window=10m lane=""
while [ $# -gt 0 ]; do
  case $1 in
    --since) since=$2; shift 2 ;;
    --warmup) warmup=$2; shift 2 ;;
    --window) window=$2; shift 2 ;;
    --lane) lane=$2; shift 2 ;;
    *) echo "report: unknown option $1" >&2; exit 2 ;;
  esac
done
secs() { case $1 in *h) echo $(( ${1%h} * 3600 )) ;; *m) echo $(( ${1%m} * 60 )) ;; *s) echo "${1%s}" ;; *) echo "$1" ;; esac; }
[ -n "$since" ] || { echo "report: no --since and no load_started in $d" >&2; exit 1; }
url=$(cat "$d/url")
# shellcheck disable=SC1091
. "$d/admin.env"
expected=$(jq -r .nodes "$d/params.json")
[ -n "$lane" ] || lane=$( [ -n "$(jq -r '.ha // empty' "$d/params.json")" ] && echo ha || echo scale )
start=$(date -u -d "$since" +%s); end=$(date -u +%s)
base_from=$(( start + $(secs "$warmup") )); w=$(secs "$window")
[ $(( end - base_from )) -ge $(( 2 * w )) ] || { echo "report: run too short for warmup $warmup + 2 x $window" >&2; exit 1; }

pmm() { # curl args... ; credentials on stdin, never argv
  printf 'user = "admin:%s"\n' "$ADMIN_PASSWORD" | curl -ksSf -m 120 --config - "$@"
}
range() { # promql -> [[ts, value], ...] of the max series over the run
  pmm -G "$url/prometheus/api/v1/query_range" --data-urlencode "query=$1" \
    --data-urlencode "start=$start" --data-urlencode "end=$end" --data-urlencode step=60 \
    | jq -c '[.data.result[0].values[]? | [.[0], (.[1] | tonumber)]]'
}

# Server nodes: pmm-server for a single container; for HA every node that is not a perf client.
srv=$(cat "$d/server_nodes" 2>/dev/null || true)
if [ -z "$srv" ]; then
  srv=$(pmm -G "$url/prometheus/api/v1/query" --data-urlencode 'query=count by (node_name) (node_cpu_seconds_total{node_name!~"pc-.*",mode="idle"})' \
    | jq -r '[.data.result[].metric.node_name] | join("|")')
fi
S="node_name=~\"$srv\""
cpu_total="sum by (node_name) (rate(node_cpu_seconds_total{$S}[2m]))"

# name|unit|gate (how a check passes)|promql
CHECKS=$(cat <<EOF
nodes_reporting|count|min_ge:$(( expected * 99 / 100 ))|count(count by (node_name) (rate(node_cpu_seconds_total{node_name=~"pc-.*",mode="idle"}[2m])))
services_up|count|min_ge:$(( expected * 99 / 100 ))|count({__name__=~"mysql_up|pg_up|mongodb_up",service_name=~"pc-.*"} == 1)
client_data_lag_s|s|p95_le:60|max(time() - max by (node_name) (timestamp(node_load1{node_name=~"pc-.*"})))
server_steal_pct|pct|valid_avg_le:5|max(100 * sum by (node_name) (rate(node_cpu_seconds_total{mode="steal",$S}[2m])) / $cpu_total)
server_cpu_busy_pct|pct|p95_le:80|max(100 - 100 * sum by (node_name) (rate(node_cpu_seconds_total{mode="idle",$S}[2m])) / $cpu_total)
server_iowait_pct|pct|trend|max(100 * sum by (node_name) (rate(node_cpu_seconds_total{mode="iowait",$S}[2m])) / $cpu_total)
server_mem_used_pct|pct|max_le:85|max(100 * (1 - node_memory_MemAvailable_bytes{$S} / node_memory_MemTotal_bytes{$S}))
server_disk_free_bytes|bytes|trend|min(node_filesystem_avail_bytes{$S,mountpoint=~"/|/srv"})
ingest_rows_per_s|rows/s|trend|sum(rate(vm_rows_inserted_total[2m]))
active_series|count|trend|max(vm_cache_entries{type="storage/hour_metric_ids"})
vm_slow_inserts_per_s|rows/s|trend|sum(rate(vm_slow_row_inserts_total[2m]))
pmm_managed_rss_bytes|bytes|trend|sum(process_resident_memory_bytes{job=~"pmm-managed.*"})
victoriametrics_rss_bytes|bytes|trend|sum(process_resident_memory_bytes{job=~"victoriametrics.*"})
EOF
)

qan_services() { # from to -> distinct perf services with QAN data
  local body; body=$(jq -n --arg f "$(date -u -d "@$1" +%FT%TZ)" --arg t "$(date -u -d "@$2" +%FT%TZ)" \
    '{period_start_from:$f, period_start_to:$t, main_metric_name:"query_time"}')
  pmm -X POST -H 'Content-Type: application/json' "$url/v1/qan/metrics:getFilters" -d "$body" \
    | jq '[.labels.service_name.name[]?.value | select(startswith("pc-"))] | length'
}

checks='[]'
while IFS='|' read -r name unit gate q; do
  vals=$(range "$q" 2>/dev/null || echo '[]')
  checks=$(jq -c --arg n "$name" --arg u "$unit" --arg g "$gate" --argjson v "$vals" \
    --argjson b0 "$base_from" --argjson b1 "$(( base_from + w ))" --argjson a0 "$(( end - w ))" '
    def avg(a): if (a | length) == 0 then null else (a | add / length) end;
    def p95(a): if (a | length) == 0 then null else (a | sort | .[((length - 1) * 0.95 | floor)]) end;
    ([$v[] | select(.[0] >= $b0) | .[1]]) as $steady
    | avg([$v[] | select(.[0] >= $b0 and .[0] < $b1) | .[1]]) as $base
    | avg([$v[] | select(.[0] >= $a0) | .[1]]) as $after
    | ($g | split(":")) as [$kind, $lim]
    | {name: $n, unit: $u, gate: $g, samples: ($v | length),
       baseline: $base, after: $after,
       deviation_pct: (if $base and $base != 0 and $after then (($after - $base) / $base * 100 * 10 | round / 10) else null end),
       avg: avg($steady), p95: p95($steady), max: ($steady | max), min: ($steady | min)}
    | .ok = (if .samples == 0 then false
             elif $kind == "min_ge" then .min >= ($lim | tonumber)
             elif $kind == "p95_le" then .p95 <= ($lim | tonumber)
             elif $kind == "max_le" then .max <= ($lim | tonumber)
             else true end)
    | . as $c | $checks + [$c]' --argjson checks "$checks" -n)
done <<<"$CHECKS"

q_base=$(qan_services "$base_from" "$(( base_from + w ))" || echo null)
q_after=$(qan_services "$(( end - w - 120 ))" "$(( end - 120 ))" || echo null)
qan_min=$(( expected * 95 / 100 ))
checks=$(jq -c --argjson b "$q_base" --argjson a "$q_after" --argjson m "$qan_min" \
  '. + [{name:"qan_services_reporting", unit:"count", gate:("min_ge:" + ($m|tostring)), baseline:$b, after:$a,
         deviation_pct:null, ok:(($b // 0) >= $m and ($a // 0) >= $m)}]' <<<"$checks")

steal=$(jq '[.[] | select(.name == "server_steal_pct")][0].avg // 0' <<<"$checks")
valid=$(jq -n --argjson s "$steal" '$s <= 5')
status=$(jq -r 'if all(.[]; .ok) then "pass" else "fail" end' <<<"$checks")
run_id=$(basename "$d" | sed 's/^perf-//')
ver=$(pmm -G "$url/v1/server/version" | jq -r '.version // "unknown"' || echo unknown)
out="$d/report-$(date -u +%Y%m%dT%H%M%SZ).json"
jq -n --arg id "$run_id-$(date -u +%Y%m%d%H%M)" --arg date "$(date -u +%FT%TZ)" --argjson scale "$expected" \
  --arg ver "$ver" --arg cimg "$(jq -r .client_image "$d/params.json")" --arg status "$status" --arg lane "$lane" \
  --argjson valid "$valid" --argjson checks "$checks" --argjson params "$(cat "$d/params.json")" \
  --arg from "$(date -u -d "@$start" +%FT%TZ)" --arg to "$(date -u -d "@$end" +%FT%TZ)" --arg srv "$srv" '
  {run_id:$id, date:$date, scale:$scale, lane:$lane, platform:"chaos", server:{from:$ver, to:$ver},
   client_version:$cimg, status:$status, valid:$valid, deviation_threshold_pct:10,
   window:{from:$from, to:$to}, server_nodes:$srv, params:$params,
   summary:(if $valid then "" else "INVALID (server CPU steal > 5%): " end)
     + "\($scale) nodes, \($lane): " + ([$checks[] | select(.ok | not) | .name] | if length == 0 then "all checks ok" else "failed: " + join(", ") end),
   checks:$checks, snapshots:[]}' >"$out"

jq -r '"\(.summary)  [\(.status), valid=\(.valid)]  \(.window.from) .. \(.window.to)  server \(.server.to)",
  (.checks[] | [.name, (if .ok then "ok" else "FAIL" end), .gate,
    "base=\(.baseline // "-" | tostring | .[0:10])", "after=\(.after // "-" | tostring | .[0:10])",
    "avg=\(.avg // "-" | tostring | .[0:10])", "p95=\(.p95 // "-" | tostring | .[0:10])", "max=\(.max // "-" | tostring | .[0:10])"] | @tsv)' "$out" | column -t -s $'\t'
echo "report: $out"
