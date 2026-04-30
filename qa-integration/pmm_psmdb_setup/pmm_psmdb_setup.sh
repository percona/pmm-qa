#!/bin/sh

# Internal variables
declare PSMDB_VERSION CLIENT_VERSION PSMDB_VERSION PSMDB_CONTAINER PMM_CONTAINER_NAME PSMDB_TARBALL PMM_CONTAINER_PORT PMM_CONTAINER_IMAGE PMM_UI_BRANCH PMM_QA_GIT_BRANCH
export CLIENT_VERSION=dev-latest
export PSMDB_CONTAINER=''
export PMM_CONTAINER_NAME=pmm-server
export PMM_CONTAINER_PORT=443
export PMM_CONTAINER_IMAGE=perconalab/pmm-server:dev-latest
export PMM_UI_BRANCH=main
export PMM_QA_GIT_BRANCH=main
export PSMDB_TARBALL=''
export PSMDB_VERSION=4.4

while [ $# -gt 0 ]; do
  case "$1" in
  	--psmdb-version=*)
      export PSMDB_VERSION="${1#*=}"
      ;;
    --client-version=*)
      export CLIENT_VERSION="${1#*=}"
      ;;
    --pmm-container-name=*)
      export PMM_CONTAINER_NAME="${1#*=}"
      ;;
    --pmm-container-port=*)
      export PMM_CONTAINER_PORT="${1#*=}"
      ;;
    --pmm-container-image=*)
      export PMM_CONTAINER_IMAGE="${1#*=}"
      ;;
    --pmm-ui-branch=*)
      export PMM_UI_BRANCH="${1#*=}"
      ;;
    --pmm-qa-branch=*)
      export PMM_QA_GIT_BRANCH="${1#*=}"
      ;;
    --psmdb-tarball=*)
      export PSMDB_TARBALL="${1#*=}"
      ;;
    *)
      printf "***************************\n"
      printf "Invalid Argument Passed, usage of this script:\n"
      echo "--psmdb-version=4.4                                               Pass PSMDB Version that needs to be setup for monitoring, default is 4.4"
      echo "--client-version=dev-latest                                       Pass the pmm2-client version, acceptable values are dev-latest (Default, if no value passed), pmm2-latest, 2.x.x, or a binary tarball http url"
      echo "--psmdb-container=psmdb                                           PSMDB & PMM-CLient Docker container name prefix, default value is psmdb"
      echo "--pmm-container-name=pmm-server                                   Pass the pmm-server name, default container name is pmm-server"
      echo "--pmm-container-port=443                                          Pass the pmm-server port, default https port number is 443, http port is 8081"
      echo "--pmm-container-image=perconalab/pmm-server:dev-latest            Pass the pmm-server image tag, default image is dev-latest"
      echo "--psmdb-tarball=''                                                Pass the psmdb tarball, default tarball is fetched for the version from Download Helper in pmm-qa"
      echo "--pmm-qa-branch=main                                              Pass the pmm-ui-tests repo branch, default using the main branch"
      echo "--pmm-ui-branch=main                                              Pass the pmm-qa repo branch, default using the main branch"
      printf "***************************\n"
      exit 1
  esac
  shift
done

declare pmm_server_data=${PMM_CONTAINER_NAME}-data

## Start creating pmm-server docker container, cleanup if one is already running with same name
docker ps -a --filter "name=${PMM_CONTAINER_NAME}" | grep -q . && docker stop ${PMM_CONTAINER_NAME} && docker rm -fv ${PMM_CONTAINER_NAME} || true
docker ps -a --filter "name=${pmm_server_data}" | grep -q . && docker stop ${pmm_server_data} && docker rm -fv ${pmm_server_data} || true
docker create -v /srv --name ${pmm_server_data} ${PMM_CONTAINER_IMAGE}
docker run -d -p 8081:80 -p ${PMM_CONTAINER_PORT}:443 -e PMM_DEBUG=1 --volumes-from ${pmm_server_data} --name ${PMM_CONTAINER_NAME} ${PMM_CONTAINER_IMAGE}



## Fetch PMM-QA Repo, this contains pgsql_pmm_setup scripts, playbook for
sudo rm -r pmm-qa || true ## Delete if the Repo already checkedout
git clone -b ${PMM_QA_GIT_BRANCH} https://github.com/percona/pmm-qa/
pushd pmm-qa/pmm-tests
## Setup a Replica 3 node
export PSMDB_CONTAINER=psmdb_pmm_${PSMDB_VERSION}_replica
bash -x ./pmm-framework.sh --addclient=mo,1 --with-replica --mongomagic --pmm2 --download
sleep 30
## Setup a regular single mongoDB instance
export PSMDB_CONTAINER=psmdb_pmm_${PSMDB_VERSION}_regular
bash -x ./pmm-framework.sh --addclient=mo,1 --mongomagic --pmm2 --download
popd


## Fetch PMM-UI-Tests Repo, this contains all the e2e tests present at path tests/qa-integration/pmm_pgsm_integration_test.js
sudo rm -r pmm-ui-tests || true ## Delete if the Repo already checkedout
git clone -b ${PMM_UI_BRANCH} https://github.com/percona/pmm-ui-tests
pushd pmm-ui-tests
npm install --force
export PMM_UI_URL="http://127.0.0.1:8081/"
./node_modules/.bin/codeceptjs run --debug --steps -c pr.codecept.js --grep '@pmm-psmdb-integration'
popd
