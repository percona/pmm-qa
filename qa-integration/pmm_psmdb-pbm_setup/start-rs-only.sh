#!/bin/bash
set -e

profile=${COMPOSE_PROFILES:-classic}
mongo_setup_type=${MONGO_SETUP_TYPE:-pss}
mongo_setup_type=${mongo_setup_type,,}
mongo_storage_engine=${MONGO_STORAGE_ENGINE:-wiredTiger}
mongo_storage_engine=${mongo_storage_engine,,}
ol_version=${OL_VERSION:-9}
minio=${MINIO:-false}
minio=${minio,,}

# Isolate this replica-set stack in its own compose project so it can run
# concurrently with the sharded stack (which shares the same service and host
# names) without either one's `down --remove-orphans` reaching the other.
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-psmdb_pss}
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
