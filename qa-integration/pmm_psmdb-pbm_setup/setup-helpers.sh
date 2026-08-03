#!/bin/bash
# Shared helpers for PSMDB compose setup scripts.

wait_mongod_node() {
  local node=$1
  local compose_file=${2:-docker-compose-rs.yaml}
  echo "waiting for mongod on ${node}"
  timeout 180 bash -c "
    until docker compose -f ${compose_file} exec -T ${node} mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1; do
      sleep 2
    done
  "
}

wait_mongod_nodes() {
  local compose_file=${1:-docker-compose-rs.yaml}
  shift
  local node
  for node in "$@"; do
    wait_mongod_node "$node" "$compose_file"
  done
}

wait_pmm_agent_connected() {
  local node=$1
  local compose_file=${2:-docker-compose-rs.yaml}
  local attempt

  for attempt in $(seq 1 30); do
    if docker compose -f "$compose_file" exec -T "$node" pmm-admin status 2>/dev/null | grep -q 'Connected'; then
      return 0
    fi
    sleep 2
  done
  return 1
}

setup_pmm_agent_on_node() {
  local node=$1
  local compose_file=${2:-docker-compose-rs.yaml}
  local node_name=$3
  local debug_flag=${4:-}
  local attempt

  for attempt in $(seq 1 5); do
    echo "configuring pmm agent on ${node} (attempt ${attempt}/5)"
    if docker compose -f "$compose_file" exec -T -e PMM_AGENT_SETUP_NODE_NAME="${node_name}" "$node" \
      pmm-agent setup ${debug_flag}; then
      if wait_pmm_agent_connected "$node" "$compose_file"; then
        return 0
      fi
      echo "pmm-agent on ${node} is not connected yet (attempt ${attempt}/5)"
    else
      echo "pmm-agent setup failed on ${node} (attempt ${attempt}/5)"
    fi
    sleep 10
  done
  return 1
}
