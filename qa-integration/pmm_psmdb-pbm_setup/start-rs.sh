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
export MONGO_SETUP_TYPE=${mongo_setup_type}
export OL_VERSION=${ol_version}

docker compose -f docker-compose-rs.yaml -f docker-compose-pmm.yaml down -v --remove-orphans
docker compose -f docker-compose-rs.yaml -f docker-compose-pmm.yaml build
docker compose -f docker-compose-pmm.yaml -f docker-compose-rs.yaml up -d
echo
echo "waiting 30 seconds for pmm-server to start"
sleep 30
echo "configuring pmm-server"
docker compose -f docker-compose-pmm.yaml exec -T pmm-server change-admin-password $pmm_server_admin_pass
echo "restarting pmm-server"
docker compose -f docker-compose-pmm.yaml restart pmm-server
echo "waiting 30 seconds for pmm-server to start"
sleep 30
if [ $mongo_setup_type == "pss" ]; then
  bash -e ./configure-replset.sh
else
  bash -e ./configure-psa.sh
fi
bash -e ./configure-agents.sh
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
