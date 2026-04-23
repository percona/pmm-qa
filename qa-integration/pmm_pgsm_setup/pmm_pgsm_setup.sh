#!/bin/sh

# Internal variables
declare PGSQL_VERSION CLIENT_VERSION PMM_CONTAINER_NAME PMM_CONTAINER_PORT PMM_CONTAINER_IMAGE PMM_UI_BRANCH PMM_QA_GIT_BRANCH PGSTAT_MONITOR_BRANCH PGSTAT_MONITOR_REPO
export CLIENT_VERSION=dev-latest
export PMM_CONTAINER_NAME=pmm-server
export PMM_CONTAINER_PORT=443
export PMM_CONTAINER_IMAGE=perconalab/pmm-server:dev-latest
export PMM_UI_BRANCH=main
export PMM_QA_GIT_BRANCH=main
export PGSTAT_MONITOR_BRANCH=main
export PGSQL_VERSION=14
export PGSTAT_MONITOR_REPO=percona/pg_stat_monitor

while [ $# -gt 0 ]; do
  case "$1" in
  	--pgsql-version=*)
      export PGSQL_VERSION="${1#*=}"
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
    --pgstat-monitor-branch=*)
      export PGSTAT_MONITOR_BRANCH="${1#*=}"
      ;;
    --pgstat-monitor-repo=*)
      export PGSTAT_MONITOR_REPO="${1#*=}"
      ;;
    *)
      printf "***************************\n"
      printf "Invalid Argument Passed, usage of this script:\n"
      echo "--pgsql-version=14                                                Pass PGSQL Version that needs to be setup for monitoring, default is 14"
      echo "--client-version=dev-latest                                       Pass the pmm2-client version, acceptable values are dev-latest (Default, if no value passed), pmm2-latest, 2.x.x, or a binary tarball http url"
      echo "--pgsql-pgsm-container=pgsql_pgsm                                 PGSQL & PMM-CLient Docker container name prefix, default value is pgsql_pgsm"
      echo "--pmm-container-name=pmm-server                                   Pass the pmm-server name, default container name is pmm-server"
      echo "--pmm-container-port=443                                          Pass the pmm-server port, default port number is 443"
      echo "--pmm-container-image=perconalab/pmm-server:dev-latest            Pass the pmm-server image tag, default image is dev-latest"
      echo "--pgstat-monitor-branch=REL_1_STABLE                              Pass the pg_stat_monitor branch for building pgsm, default using the release branch"
      echo "--pgstat-monitor-repo=percona/pg_stat_monitor                     Pass the pg_stat_monitor Repo for building pgsm, default using the release branch"
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
bash -x ./pmm-framework.sh --pdpgsql-version=${PGSQL_VERSION} --setup-pmm-pgsm-integration
popd


## Fetch PMM-UI-Tests Repo, this contains all the e2e tests present at path tests/qa-integration/pmm_pgsm_integration_test.js
sudo rm -r pmm-ui-tests || true ## Delete if the Repo already checkedout
git clone -b ${PMM_UI_BRANCH} https://github.com/percona/pmm-ui-tests
pushd pmm-ui-tests
npm install --force
export PMM_UI_URL="http://127.0.0.1:8081/"
./node_modules/.bin/codeceptjs run --debug --steps -c pr.codecept.js --grep '@pgsm-pmm-integration'
popd
