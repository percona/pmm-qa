#!/bin/bash
set -e

profile=${COMPOSE_PROFILES:-classic}
mongo_setup_type=${MONGO_SETUP_TYPE:-pss}
mongo_setup_type=${mongo_setup_type,,}
mongo_storage_engine=${MONGO_STORAGE_ENGINE:-wiredTiger}
mongo_storage_engine=${mongo_storage_engine,,}
mongo_query_source=${MONGO_QUERY_SOURCE:-profiler}
mongo_query_source=${mongo_query_source,,}
ol_version=${OL_VERSION:-9}
minio=${MINIO:-true}
minio=${minio,,}

# Isolate this replica-set stack in its own compose project so it can run
# concurrently with the sharded stack (which shares the same service and host
# names) without either one's `down --remove-orphans` reaching the other.
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-psmdb_pss}
export COMPOSE_PROFILES=${profile}
export MONGO_SETUP_TYPE=${mongo_setup_type}
export OL_VERSION=${ol_version}

# Pick the base mongod config for the storage engine.
if [ "$mongo_storage_engine" = "inmemory" ]; then
    base_config=./conf/mongod-rs-inmemory/mongod.conf
else
    mongo_storage_engine="wiredTiger"
    base_config=./conf/mongod-rs/mongod.conf
fi

# Materialise a generated config when it must diverge from the shipped default:
# the in-memory engine ships its own config, and mongolog QAN needs mongod to
# write a log FILE -- the shipped configs log to syslog, which the built-in
# mongolog agent cannot tail (it exits with "no log path found").
if [ "$mongo_storage_engine" = "inmemory" ] || [ "$mongo_query_source" = "mongolog" ]; then
    generated_config_dir="/tmp/pmm-qa-mongod-rs-generated"
    rm -rf "$generated_config_dir"
    mkdir -p "$generated_config_dir"
    cp "$base_config" "$generated_config_dir/mongod.conf"
    if [ "$mongo_query_source" = "mongolog" ]; then
        sed -i 's#destination: syslog#destination: file\n  path: /var/log/mongo/mongod.log\n  logAppend: true#' "$generated_config_dir/mongod.conf"
    fi
    export MONGOD_RS_CONFIG_DIR="$generated_config_dir"
fi

docker network create qa-integration || true
docker network create pmm-qa || true
docker network create pmm-ui-tests_pmm-network || true
docker network create pmm2-upgrade-tests_pmm-network || true
docker network create pmm2-ui-tests_pmm-network || true

docker compose -f docker-compose-rs.yaml down -v --remove-orphans
docker compose -f docker-compose-rs.yaml build --no-cache
# minio backs PBM's S3 store; the caller selects which stack runs it via MINIO.
if [ "$minio" != "false" ]; then
  echo "starting minio container"
  docker compose -f docker-compose-rs.yaml up -d --no-deps minio createbucket
else
  echo "skipping minio container (MINIO=false)"
fi

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
