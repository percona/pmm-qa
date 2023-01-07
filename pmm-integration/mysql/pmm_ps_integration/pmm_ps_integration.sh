echo "Setting up PMM and Percona Server Integration"PS_VERSION

## only doing it for jenkins workers, need ansible installed on the host
export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
docker network create pmm-qa || true
docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true
if [ -z "$PS_VERSION" ]
then
  export PS_VERSION=${ps_version}
fi
if [ -z "$CLIENT_VERSION" ]
then
  export CLIENT_VERSION=dev-latest
fi
if [ -z "$QUERY_SOURCE" ]
then
  export QUERY_SOURCE=${query_source}
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
if [ -z "${PS_CONTAINER}" ]
then
  export PS_CONTAINER=ps_pmm_${PS_VERSION}
else
  export PS_CONTAINER=${PS_CONTAINER}_${PS_VERSION}
fi
export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}
