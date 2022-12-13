echo "Setting up PMM and HAPROXY Integration"

export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
docker network create pmm-qa || true
docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true
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
export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}
