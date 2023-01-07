echo "Setting up PMM and PSMDB Integration"

export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
docker network create pmm-qa || true
docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true

if echo "$MO_VERSION" | grep '4.4'; then
  export PSMDB_VERSION=4.4
fi
if echo "$MO_VERSION" | grep '5.0'; then
  export PSMDB_VERSION=5.0
fi
if echo "$MO_VERSION" | grep '6.0'; then
  export PSMDB_VERSION=6.0
fi
if echo "$MO_VERSION" | grep '4.2'; then
  export PSMDB_VERSION=4.2
fi
if echo "$MO_VERSION" | grep '4.0'; then
  export PSMDB_VERSION=4.0
fi
if echo "$with_sharding" | grep '1'; then
  export PSMDB_SETUP=sharded
fi
if echo "$with_replica" | grep '1'; then
  export PSMDB_SETUP=replica
fi
if [ -z "$CLIENT_VERSION" ]
then
  export CLIENT_VERSION=dev-latest
fi
if [ -z "${PMM_SERVER_DOCKER_CONTAINER}" ]
then
  if [ ! -z "${PMM2_SERVER_IP}" ]
  then
    export PMM_SERVER_IP=${PMM2_SERVER_IP}
  else
    export PMM_SERVER_IP=127.0.0.1
  fi
else
  export PMM_SERVER_IP=${PMM_SERVER_DOCKER_CONTAINER}
fi
if [ -z "${PSMDB_CONTAINER}" ]
then
  export PSMDB_CONTAINER=psmdb_pmm_${PSMDB_VERSION}
else
  export PSMDB_CONTAINER=${PSMDB_CONTAINER}_${PSMDB_VERSION}
fi
export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}
