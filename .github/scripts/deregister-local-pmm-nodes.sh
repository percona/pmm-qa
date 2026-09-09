#!/usr/bin/env bash
# Remove from a PMM Server the nodes registered by containers that live on this
# runner, so a retried setup does not leave a dead half-registration behind.
#
# The nightly matrix points several runners at one long-lived remote PMM Server.
# When a setup attempt times out, the retry wipes the runner's Docker state but
# the nodes, services and agents it had already registered stay on the server
# with no agent behind them, and every later test that walks the inventory or a
# node dashboard fails on them.
#
# Scoped deliberately to this runner's own containers: the candidate names come
# from the local Docker state, never from the server's node list, so a shard can
# never delete another shard's nodes.

set -uo pipefail

: "${SERVER_IP:?SERVER_IP must be set}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD must be set}"

CURL_OPTS=(--silent --show-error --insecure --connect-timeout 10 --max-time 60)
AUTH=(--user "admin:${ADMIN_PASSWORD}")
BASE="https://${SERVER_IP}"

candidates_file=$(mktemp)
trap 'rm -f "$candidates_file"' EXIT

# Container id, container name and configured hostname all show up as node names
# depending on how a setup registers its client, so collect all three.
{
  docker ps -a --format '{{.ID}}'
  docker ps -a --format '{{.Names}}'
  docker ps -aq | while read -r cid; do
    docker inspect -f '{{.Config.Hostname}}' "$cid" 2>/dev/null || true
  done
} 2>/dev/null | sed '/^$/d' | sort -u >"$candidates_file"

if [ ! -s "$candidates_file" ]; then
  echo "deregister: no local containers, nothing to deregister"
  exit 0
fi

# Never delete the runner's own node: the client-setup step registers it once and
# the retried attempt reuses it. The PMM Server's own node is always node_id
# "pmm-server" and is refused with a 403 anyway; it is only a candidate at all
# when the server runs as a local container, which is not the nightly's layout
# but is how a reproduction box is built.
runner_node=$(hostname)

nodes_json=$(curl "${CURL_OPTS[@]}" "${AUTH[@]}" "${BASE}/v1/management/nodes")
rc=$?
if [ "$rc" -ne 0 ] || [ -z "$nodes_json" ]; then
  echo "deregister: could not read the node inventory from ${SERVER_IP} (curl rc=${rc}); leaving it alone" >&2
  exit 0
fi

mapfile -t doomed < <(
  printf '%s' "$nodes_json" |
    jq -r --arg runner "$runner_node" --rawfile names "$candidates_file" '
      ($names | split("\n") | map(select(length > 0))) as $local
      | [.. | objects | select(has("node_id") and has("node_name"))]
      | unique_by(.node_id)
      | .[]
      | select(.node_id != "pmm-server" and .node_name != $runner)
      | select(.node_name as $n | $local | index($n))
      | "\(.node_id)\t\(.node_name)"
    ' 2>/dev/null
)

if [ "${#doomed[@]}" -eq 0 ]; then
  echo "deregister: no stale nodes for this runner's containers"
  exit 0
fi

failed=0
for entry in "${doomed[@]}"; do
  node_id=${entry%%$'\t'*}
  node_name=${entry#*$'\t'}
  code=$(curl "${CURL_OPTS[@]}" "${AUTH[@]}" -o /dev/null -w '%{http_code}' \
    -X DELETE "${BASE}/v1/management/nodes/${node_id}?force=true")
  if [ "$code" = "200" ]; then
    echo "deregister: removed node ${node_name} (${node_id})"
  else
    echo "deregister: failed to remove node ${node_name} (${node_id}), http=${code}" >&2
    failed=$((failed + 1))
  fi
done

if [ "$failed" -gt 0 ]; then
  echo "deregister: ${failed} node(s) left on the server; the next attempt starts from a dirty inventory" >&2
fi

exit 0
