#!/usr/bin/env bash
# Remove from a PMM Server the nodes registered by containers that live on this
# runner, so a retried setup does not leave a dead half-registration behind.
#
# Several runners share one PMM Server, so what this deletes has to be scoped to
# this runner and nothing else. Each container is asked to unregister itself,
# which names no node but its own; only what that misses falls back to matching
# the inventory, and then against container ids alone. A container name or a
# configured hostname is unique to one Docker daemon, not to the fleet --
# docker-compose-rs.yaml and docker-compose-sharded.yaml both pin rs101..rs203,
# and those setups run on different runners against the same server.

set -uo pipefail

: "${SERVER_IP:?SERVER_IP must be set}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD must be set}"

# The PMM Server presents a self-signed certificate, as every other curl against
# it in this workflow assumes (the readyz sanity check and the server-log
# download both pass -k), so verification is off here for the same reason.
CURL_OPTS=(--silent --show-error --insecure --connect-timeout 10 --max-time 60)
AUTH=(--user "admin:${ADMIN_PASSWORD}")
BASE="https://${SERVER_IP}"

mapfile -t containers < <(docker ps -aq 2>/dev/null)
if [ "${#containers[@]}" -eq 0 ]; then
  echo "deregister: no local containers, nothing to deregister"
  exit 0
fi

# A PMM Server running as a local container carries pmm-admin too, and asking it
# to unregister would remove the server's own node.
is_pmm_server() {
  local name image
  name=$(docker inspect -f '{{.Name}}' "$1" 2>/dev/null)
  image=$(docker inspect -f '{{.Config.Image}}' "$1" 2>/dev/null)
  case "${name}#${image}" in
    */pmm-server#* | *pmm-server:*) return 0 ;;
  esac
  return 1
}

leftovers=()
for cid in "${containers[@]}"; do
  if is_pmm_server "$cid"; then
    continue
  fi
  # --force is missing from `pmm-admin unregister --help`, but it is required
  # and it works: without it the command refuses a node that still has agents
  # ("Node with ID ... has agents", rc=1), which is every node a setup creates.
  if docker exec "$cid" pmm-admin unregister --force >/dev/null 2>&1; then
    echo "deregister: container ${cid} unregistered its own node"
  else
    leftovers+=("$cid")
  fi
done

if [ "${#leftovers[@]}" -eq 0 ]; then
  echo "deregister: every container unregistered itself"
  exit 0
fi

# Fall back to the server's inventory for containers that could not be reached
# (stopped, or no pmm-admin inside), matching container ids only.
# --fail so an HTTP error takes the branch below: without it curl exits 0 on a
# 401 or a 502, jq finds no node_id in the error body, and a server this script
# could not actually read reports "no stale nodes" and looks like it worked.
nodes_json=$(curl "${CURL_OPTS[@]}" "${AUTH[@]}" --fail "${BASE}/v1/management/nodes")
rc=$?
if [ "$rc" -ne 0 ] || [ -z "$nodes_json" ]; then
  echo "deregister: could not read the node inventory from ${SERVER_IP} (curl rc=${rc}); leaving it alone" >&2
  exit 0
fi

ids_file=$(mktemp)
trap 'rm -f "$ids_file"' EXIT
printf '%s\n' "${leftovers[@]}" >"$ids_file"

mapfile -t doomed < <(
  printf '%s' "$nodes_json" |
    jq -r --rawfile ids "$ids_file" '
      ($ids | split("\n") | map(select(length > 0))) as $local
      | [.. | objects | select(has("node_id") and has("node_name"))]
      | unique_by(.node_id)
      | .[]
      | select(.node_id != "pmm-server")
      | select(.node_name as $n | $local | index($n))
      | "\(.node_id)\t\(.node_name)"
    ' 2>/dev/null
)

if [ "${#doomed[@]}" -eq 0 ]; then
  echo "deregister: ${#leftovers[@]} container(s) could not unregister themselves and match no node by container id"
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
