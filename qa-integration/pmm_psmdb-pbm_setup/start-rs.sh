#!/bin/bash
set -e

pmm_server_admin_pass=${ADMIN_PASSWORD:-password}
profile=${COMPOSE_PROFILES:-classic}
mongo_setup_type=${MONGO_SETUP_TYPE:-pss}
ol_version=${OL_VERSION:-9}
minio=${MINIO:-false}
minio=${minio,,}

docker network create qa-integration || true
docker network create pmm-qa || true
docker network create pmm-ui-tests_pmm-network || true
docker network create pmm2-upgrade-tests_pmm-network || true
docker network create pmm2-ui-tests_pmm-network || true

# Start (or reuse) the shared minio container. Locked so that concurrent
# --parallel setups can't both pass the "does minio exist" check before
# either has actually created it, and both then try to create a container
# named "minio". --no-deps keeps the locked section short: it starts just
# minio/createbucket without pulling in the rest of this stack.
# Skipped entirely when MINIO=false.
if [ "$minio" != "false" ]; then
  minio_lock=${TMPDIR:-/tmp}/pmm-qa-minio.lock
  (
    flock -x 200
    if docker ps -a --filter name=minio --format '{{.Names}}' | grep -qx minio; then
      echo "minio container exists, reusing it"
    else
      echo "starting shared minio container"
      docker compose -f docker-compose-rs.yaml up -d --no-deps minio createbucket
    fi
  ) 200>"$minio_lock"
else
  echo "skipping minio container (MINIO=false)"
fi
export COMPOSE_PROFILES=${profile}
export MONGO_SETUP_TYPE=${mongo_setup_type}
export OL_VERSION=${ol_version}

docker compose -f docker-compose-rs.yaml -f docker-compose-pmm.yaml down -v --remove-orphans
docker compose -f docker-compose-rs.yaml -f docker-compose-pmm.yaml build
docker compose -f docker-compose-pmm.yaml -f docker-compose-rs.yaml up -d
echo
echo "waiting for pmm-server to start"
timeout 120 bash -c 'until [ "$(curl -ks -o /dev/null -w "%{http_code}" --user "admin:'"$pmm_server_admin_pass"'" https://127.0.0.1/v1/server/readyz)" = "200" ]; do sleep 5; done'
if [ $mongo_setup_type == "pss" ]; then
  bash -e ./configure-replset.sh
else
  bash -e ./configure-psa.sh
fi
bash -e ./configure-agents.sh

generate_traffic=${GENERATE_TRAFFIC:-yes}
if [ $generate_traffic != "no" ]; then
    echo
    echo "generating opcountersRepl traffic (insert/update/delete) against the replica set"
    COMPOSE_FILE=docker-compose-rs.yaml MONGO_SERVICE=rs101 MONGO_URI="mongodb://root:root@localhost/?replicaSet=rs" bash ./generate_opcountersrepl_traffic.sh
else
    echo
    echo "skipping opcountersRepl traffic generation"
fi

tests=${TESTS:-yes}
if [ $tests != "no" ]; then
    echo
    echo "running tests"
    docker compose -f docker-compose-pmm.yaml --profile tests run test pytest -s -x --verbose test.py
    docker compose -f docker-compose-pmm.yaml --profile tests run test chmod -R 777 .
    else
    echo
    echo "skipping tests"
fi
cleanup=${CLEANUP:-yes}
if [ $cleanup != "no" ]; then
    echo
    echo "cleanup"
    docker compose -f docker-compose-rs.yaml -f docker-compose-pmm.yaml down -v --remove-orphans
    else
    echo
    echo "skipping cleanup"
fi
