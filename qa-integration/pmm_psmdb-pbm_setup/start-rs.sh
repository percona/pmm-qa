#!/bin/bash
set -e

pmm_server_admin_pass=${ADMIN_PASSWORD:-password}
profile=${COMPOSE_PROFILES:-classic}
mongo_setup_type=${MONGO_SETUP_TYPE:-pss}
ol_version=${OL_VERSION:-9}

docker network create qa-integration || true
docker network create pmm-qa || true
docker network create pmm-ui-tests_pmm-network || true
docker network create pmm2-upgrade-tests_pmm-network || true
docker network create pmm2-ui-tests_pmm-network || true

export COMPOSE_PROFILES=${profile}

# Start our own minio only if no other setup is already running one.
if docker ps -a --filter name=minio --format '{{.Names}}' | grep -qx minio; then
    echo "minio container exists, reusing it"
else
    COMPOSE_PROFILES="${COMPOSE_PROFILES:+$COMPOSE_PROFILES,}minio"
fi
export COMPOSE_PROFILES
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
    docker compose -f docker-compose-pmm.yaml run test pytest -s -x --verbose test.py
    docker compose -f docker-compose-pmm.yaml run test chmod -R 777 .
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
