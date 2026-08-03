#!/bin/bash
set -euo pipefail

compose_file=${1:-docker-compose-rs.yaml}
nodes=${2:-rs101 rs102 rs103}

for node in $nodes; do
  echo "waiting for mongod on $node"
  timeout 180 bash -c "until docker compose -f ${compose_file} exec -T ${node} mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1; do sleep 2; done"
done
