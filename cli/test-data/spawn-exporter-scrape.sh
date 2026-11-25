#!/usr/bin/env bash
# Runs a second mongodb_exporter binary with the flags and the MongoDB URI of the exporter that pmm-agent runs on a port,
# scrapes it a number of times and prints each scrape and the exporter's own log, so builds can be compared on one node.
# Usage: spawn-exporter-scrape.sh BINARY AGENT_PORT SCRAPES
# EXPORTER_USER and EXPORTER_PASSWORD, when set, replace the credentials in the URI.
set -u

binary=$1
agent_port=$2
scrapes=$3

pid=$(pgrep -f -- "--web.listen-address=127.0.0.1:${agent_port} " | head -n 1)
if [[ -z $pid ]]; then
  echo "No mongodb_exporter listens on ${agent_port}" >&2
  exit 2
fi

uri=$(tr '\0' '\n' </proc/"$pid"/environ | sed -n 's/^MONGODB_URI=//p')
if [[ -n ${EXPORTER_USER:-} ]]; then
  uri=$(sed -E "s#^(mongodb://)[^@]*@#\1${EXPORTER_USER}:${EXPORTER_PASSWORD}@#" <<<"$uri")
fi
mapfile -t flags < <(tr '\0' '\n' </proc/"$pid"/cmdline | tail -n +2 | grep -v -e '^--web\.listen-address=' -e '^--web\.config=')

log=$(mktemp)
exporter=''
trap 'kill "$exporter" 2>/dev/null; rm -f "$log"' EXIT

# Returns 1 only when the exporter could not bind its port; one that is just slow is left to the scrape loop to report.
listening() {
  for _ in $(seq 1 30); do
    curl -s -o /dev/null --max-time 5 "http://127.0.0.1:${spawn_port}/" && return 0
    grep -q 'address already in use' "$log" && return 1
    sleep 1
  done
  return 0
}

# A port in pmm-agent's range can already be the local end of an outgoing connection in the container, so try the next one.
for spawn_port in $(seq $((agent_port + 2000)) $((agent_port + 2009))); do
  MONGODB_URI=$uri "$binary" "${flags[@]}" "--web.listen-address=127.0.0.1:${spawn_port}" >"$log" 2>&1 &
  exporter=$!
  listening && break
  kill "$exporter" 2>/dev/null
  wait "$exporter" 2>/dev/null
done

for i in $(seq 1 "$scrapes"); do
  echo "---SCRAPE ${i}---"
  for _ in $(seq 1 30); do
    body=$(curl -sf --max-time 120 "http://127.0.0.1:${spawn_port}/metrics") && break
    body=''
    sleep 1
  done
  if [[ -z $body ]]; then
    echo "No scrape of the exporter on ${spawn_port}; its log:" >&2
    cat "$log" >&2
    exit 3
  fi
  grep -E '^(mongodb_pbm_|mongodb_up)' <<<"$body"
done
echo '---LOG---'
cat "$log"
