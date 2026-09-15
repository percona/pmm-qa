#!/usr/bin/env bash
# Sample the performance checks defined in thresholds.yml against a running PMM
# server and write a JSON summary the Performance Analyst skill then judges.
#
# Reads metrics through Grafana's datasource proxy (the same path e2e_tests uses;
# PMM's /prometheus route 500s on the single-node query path). Self-signed TLS on
# the PMM server, hence curl -k -- matches the repo's `curl -ksS` convention.
#
#   ADMIN_PASSWORD=... collect_metrics.sh --server <host> --thresholds thresholds.yml --out metrics.json
set -Eeuo pipefail

SERVER="" THRESHOLDS="" OUT="metrics.json" WINDOW="" STEP=""
while [ $# -gt 0 ]; do
  case "$1" in
    --server)     SERVER="$2"; shift 2 ;;
    --thresholds) THRESHOLDS="$2"; shift 2 ;;
    --out)        OUT="$2"; shift 2 ;;
    --window)     WINDOW="$2"; shift 2 ;;
    --step)       STEP="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
: "${SERVER:?--server <host> (no scheme) is required}"
: "${THRESHOLDS:?--thresholds <file> is required}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }
command -v python3 >/dev/null || { echo "python3 is required (YAML parsing)" >&2; exit 1; }

host="${SERVER#http://}"; host="${host#https://}"; host="${host%/}"
CURL=(curl -ksS --connect-timeout 10 --max-time 60 -u "admin:${ADMIN_PASSWORD}")

cfg="$(python3 -c 'import sys,yaml,json; json.dump(yaml.safe_load(open(sys.argv[1])), sys.stdout)' "$THRESHOLDS")"
WINDOW="${WINDOW:-$(printf '%s' "$cfg" | jq -r '.window // "30m"')}"
STEP="${STEP:-$(printf '%s' "$cfg" | jq -r '.step // "15s"')}"

to_seconds() { case "$1" in *h) echo $(( ${1%h} * 3600 ));; *m) echo $(( ${1%m} * 60 ));; *s) echo "${1%s}";; *) echo "$1";; esac; }
end="$(date -u +%s)"; start="$(( end - $(to_seconds "$WINDOW") ))"; step_s="$(to_seconds "$STEP")"

uid="$("${CURL[@]}" "https://${host}/graph/api/datasources" | jq -r 'map(select(.type=="prometheus"))[0].uid // empty')"
[ -n "$uid" ] || { echo "no prometheus datasource found on ${host}" >&2; exit 1; }
base="https://${host}/graph/api/datasources/proxy/uid/${uid}/api/v1/query_range"

results='[]'
while read -r check; do
  promql="$(jq -r '.promql' <<<"$check")"
  enc="$(jq -rn --arg q "$promql" '$q|@uri')"
  resp="$("${CURL[@]}" "${base}?query=${enc}&start=${start}&end=${end}&step=${step_s}" 2>/dev/null || echo '{}')"
  vals="$(jq -c '[.data.result[]?.values[]? ] ' <<<"$resp")"
  observed="$(jq -n --argjson v "$vals" '
    ($v | map(.[1]|tonumber)) as $n |
    { max:   ($n | if length>0 then max else null end),
      avg:   ($n | if length>0 then (add/length) else null end),
      last:  ($v | sort_by(.[0]) | if length>0 then (last[1]|tonumber) else null end),
      samples: ($n | length) }')"
  results="$(jq -c --argjson c "$check" --argjson o "$observed" \
    '. + [{name:$c.name, promql:$c.promql, unit:$c.unit, stat:$c.stat, op:$c.op, threshold:$c.max, observed:$o}]' <<<"$results")"
done < <(printf '%s' "$cfg" | jq -c '.checks[]')

jq -n --arg server "$host" --arg window "$WINDOW" --arg gen "$(date -u +%FT%TZ)" --argjson checks "$results" \
  '{server:$server, window:$window, generated_at:$gen, checks:$checks}' > "$OUT"
echo "wrote $(jq '.checks|length' "$OUT") check(s) to $OUT (window=$WINDOW, datasource=$uid)"
