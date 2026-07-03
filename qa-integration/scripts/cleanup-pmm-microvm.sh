#!/usr/bin/env bash
# Tear down PMM Server and QA integration containers on MicroVM.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "==> Stopping PMM server stack..."
for name in pmm-server watchtower; do
  docker rm -f "$name" 2>/dev/null || true
done

echo "==> Stopping PSMDB/PBM replica set (if present)..."
if [ -f "${QA_ROOT}/pmm_psmdb-pbm_setup/docker-compose-rs.yaml" ]; then
  (
    cd "${QA_ROOT}/pmm_psmdb-pbm_setup"
    export PMM_QA_NO_SYSTEMD=1
    docker compose -f docker-compose-rs.yaml -f docker-compose-rs.microvm.yaml down -v --remove-orphans 2>/dev/null \
      || docker compose -f docker-compose-rs.yaml down -v --remove-orphans 2>/dev/null \
      || true
    docker compose -f docker-compose-sharded.yaml -f docker-compose-sharded.microvm.yaml down -v --remove-orphans 2>/dev/null \
      || docker compose -f docker-compose-sharded.yaml down -v --remove-orphans 2>/dev/null \
      || true
  )
fi

for name in rs101 rs102 rs103 rs201 rs202 rs203 rscfg01 rscfg02 rscfg03 mongos rs-test minio createbucket kerberos; do
  docker rm -f "$name" 2>/dev/null || true
done

if docker network inspect pmm-qa >/dev/null 2>&1; then
  while read -r cid; do
    [ -n "$cid" ] || continue
    docker rm -f "$cid" 2>/dev/null || true
  done < <(docker network inspect pmm-qa -f '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' 2>/dev/null || true)
fi

if [ "${REMOVE_VOLUME:-0}" = "1" ]; then
  echo "==> Removing pmm-data volume..."
  docker volume rm pmm-data 2>/dev/null || true
fi

if [ "${REMOVE_NETWORK:-0}" = "1" ]; then
  echo "==> Removing pmm-qa network..."
  docker network rm pmm-qa 2>/dev/null || true
fi

sudo rm -rf /tmp/backup_data /tmp/minio 2>/dev/null || true
mkdir -m 777 -p /tmp/backup_data

echo "Cleanup done."
