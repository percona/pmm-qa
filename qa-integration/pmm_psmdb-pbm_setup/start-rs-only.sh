#!/bin/bash
set -e

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

docker compose -f docker-compose-rs.yaml down -v --remove-orphans
docker compose -f docker-compose-rs.yaml build --no-cache
docker compose -f docker-compose-rs.yaml up -d
echo
echo "waiting 60 seconds for replica set members to start"
sleep 60
echo
if [ $mongo_setup_type == "pss" ]; then
  bash -e ./configure-replset.sh
else
  bash -e ./configure-psa.sh
fi
bash -x ./configure-agents.sh

if [ $profile = "extra" ]; then
  if [ $mongo_setup_type == "pss" ]; then
    bash -x ./configure-extra-replset.sh
  else
    bash -x ./configure-extra-psa.sh
  fi
  bash -x ./configure-extra-agents.sh
fi
