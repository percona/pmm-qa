echo "Setting up PMM and PGSM Integration"
sudo yum install -y ansible
export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')
docker network create pmm-qa || true
docker network connect pmm-qa ${PMM_SERVER_DOCKER_CONTAINER} || true
pushd $SCRIPT_PWD/
if [ -z $PGSQL_VERSION ] 
then
  export PGSQL_VERSION=15
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
if [ -z "${PGSQL_PGSM_CONTAINER}" ]
then
  export PGSQL_PGSM_CONTAINER=pgsql_pgsm_${PGSQL_VERSION}
else
  export PGSQL_PGSM_CONTAINER=${PGSQL_PGSM_CONTAINER}_${PGSQL_VERSION}
fi
export PMM_QA_GIT_BRANCH=${PMM_QA_GIT_BRANCH}

ansible-playbook --connection=local --inventory 127.0.0.1, --limit 127.0.0.1 /srv/pmm-qa/pmm-integration/postgres/pgsql_pgsm_setup/pgsql_pgsm_setup.yml
popd
