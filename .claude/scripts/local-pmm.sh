#!/usr/bin/env bash
# Local PMM for a migration: pmm-server from e2e_tests/docker-compose.yml plus
# databases from pmm-framework on images already in Docker, built when missing.
#
#   bash .claude/scripts/local-pmm.sh up [pmm-framework args...]   # e.g. --database ps=8.4
#   bash .claude/scripts/local-pmm.sh down
#
# Env: ADMIN_PASSWORD (default admin-password), DOCKER_VERSION (server image),
#      PMM_ENABLE_NOMAD=1 for Nomad tests (pass --nomad to the framework too).
set -euo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
compose=(docker compose -f "$repo/e2e_tests/docker-compose.yml")
export ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin-password}
# Empty registry: never pull a database image; reuse the local pmm-qa/<engine>:<tag> or build it.
export PREBAKED_REGISTRY=

case ${1:-} in
  up)
    shift
    docker network inspect pmm-qa >/dev/null 2>&1 || docker network create pmm-qa >/dev/null
    "${compose[@]}" up -d pmm-server
    timeout 300 bash -c 'until [ "$(curl -sk -o /dev/null -w "%{http_code}" https://127.0.0.1/v1/server/readyz)" = 200 ]; do sleep 5; done'
    (($# == 0)) || "$repo/qa-integration/pmm_qa/pmm-framework/pmm-framework" --parallel "$@"
    ;;
  down)
    ids=$( { docker ps -aq --filter label=pmm-qa.engine; docker ps -aq --filter network=pmm-qa; } | sort -u)
    if [[ -n $ids ]]; then
      # Named volumes (<node>_pmm, minio_backups, ...) survive rm -v; collect them first.
      vols=$(docker inspect -f '{{range .Mounts}}{{if .Name}}{{.Name}} {{end}}{{end}}' $ids)
      docker rm -fv $ids >/dev/null
      [[ -z ${vols// } ]] || docker volume rm -f $vols >/dev/null
    fi
    "${compose[@]}" down -v --remove-orphans
    docker network rm pmm-qa >/dev/null 2>&1 || true
    ;;
  *) echo "Usage: $0 up [pmm-framework args...] | down" >&2; exit 2 ;;
esac
