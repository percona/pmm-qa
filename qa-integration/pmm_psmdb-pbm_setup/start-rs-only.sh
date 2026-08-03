#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=setup-helpers.sh
source "${SCRIPT_DIR}/setup-helpers.sh"

profile=${COMPOSE_PROFILES:-classic}
mongo_setup_type=${MONGO_SETUP_TYPE:-pss}
mongo_setup_type=${mongo_setup_type,,}
mongo_storage_engine=${MONGO_STORAGE_ENGINE:-wiredTiger}
mongo_storage_engine=${mongo_storage_engine,,}
ol_version=${OL_VERSION:-9}


export COMPOSE_PROFILES=${profile}
export MONGO_SETUP_TYPE=${mongo_setup_type}
export OL_VERSION=${ol_version}

if [ "$mongo_storage_engine" = "inmemory" ]; then

    generated_config_dir="/tmp/pmm-qa-mongod-rs-inmemory"
    rm -rf "$generated_config_dir"
    mkdir -p "$generated_config_dir"
    cp ./conf/mongod-rs-inmemory/mongod.conf "$generated_config_dir/mongod.conf"
    export MONGOD_RS_CONFIG_DIR="$generated_config_dir"
else
    mongo_storage_engine="wiredTiger"
fi

docker network create qa-integration || true
docker network create pmm-qa || true
docker network create pmm-ui-tests_pmm-network || true
docker network create pmm2-upgrade-tests_pmm-network || true
docker network create pmm2-ui-tests_pmm-network || true

docker compose -f docker-compose-rs.yaml down -v --remove-orphans
docker compose -f docker-compose-rs.yaml build --no-cache
docker compose -f docker-compose-rs.yaml up -d
echo
echo "waiting for replica set members to start"
wait_mongod_nodes docker-compose-rs.yaml rs101 rs102 rs103
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
  wait_mongod_nodes docker-compose-rs.yaml rs201 rs202 rs203
  bash -x ./configure-extra-agents.sh
fi

echo "verifying all replica set members are reachable"
wait_mongod_nodes docker-compose-rs.yaml rs101 rs102 rs103
if [ $profile = "extra" ]; then
  wait_mongod_nodes docker-compose-rs.yaml rs201 rs202 rs203
fi
