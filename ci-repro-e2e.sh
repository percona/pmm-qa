#!/bin/bash
# Local reproduction of .github/workflows/runner-e2e-tests-codeceptjs.yml.
# Mirrors the CI steps, order and environment so failures reproduce faithfully.
#
#   ./ci-repro-e2e.sh '@bm-mongo' '--database psmdb,SETUP_TYPE=pss,COMPOSE_PROFILES=extra'
#   ./ci-repro-e2e.sh '@user-password' '--database ps --database psmdb --database pdpgsql'
#
# Launchable is not reachable from here, so the subset is rebuilt the same way
# `launchable subset --confidence 100%` does: every file carrying the tag.
set -o pipefail

# A GitHub runner starts each job from a clean environment. Stray values such as
# COMPOSE_PROFILES or PMM_CLIENT_VERSION left over from an earlier command in the
# same shell silently change the setup, so drop everything before doing any work.
if [[ -z ${CI_REPRO_CLEAN_ENV:-} ]]; then
  exec env -i \
    CI_REPRO_CLEAN_ENV=1 \
    HOME="${HOME}" \
    PATH="${PATH}" \
    TERM="${TERM:-xterm}" \
    "$0" "$@"
fi

REPO_ROOT=$(cd "$(dirname "$0")" && pwd)

export TAGS_FOR_TESTS=${1:-@bm-mongo}
export WIZARD_ARGS=${2:---database psmdb,SETUP_TYPE=pss,COMPOSE_PROFILES=extra}

export ADMIN_PASSWORD='admin-password'
export DOCKER_VERSION='perconalab/pmm-server:3-dev-latest'
export DOCKER_COMPOSE_FILE='docker-compose.yml'
export PMM_CLIENT_VERSION='latest-tarball'
export CLIENT_VERSION="${PMM_CLIENT_VERSION}"
export SERVER_IP='127.0.0.1'
export PMM_UI_URL='http://127.0.0.1/'
export PMM_URL="http://admin:${ADMIN_PASSWORD}@${SERVER_IP}"
case "${WIZARD_ARGS}" in *GSSAPI*) export GSSAPI_ENABLED=true ;; *) export GSSAPI_ENABLED=false ;; esac

step() { echo; echo "===== $(date -u +%H:%M:%S) $* ====="; }

step "Cleanup previous environment"
cd "${REPO_ROOT}/codeceptjs-e2e"
docker compose -f "${DOCKER_COMPOSE_FILE}" down -v --remove-orphans 2>/dev/null
cd "${REPO_ROOT}/qa-integration/pmm_psmdb-pbm_setup"
docker compose -f docker-compose-rs.yaml down -v --remove-orphans 2>/dev/null
docker ps -aq | xargs -r docker rm -f >/dev/null 2>&1
sudo rm -rf /tmp/backup_data

step "Setup npm modules for e2e tests"
cd "${REPO_ROOT}/codeceptjs-e2e"
envsubst < env.list > env.generated.list

step "Prepare subset for ${TAGS_FOR_TESTS}"
node launchable-prepare.js "${TAGS_FOR_TESTS}" || exit 1
SUBSET=$(python3 -c '
import json, sys
files = [l.strip() for l in open("test_list.txt") if l.strip()]
print(json.dumps({"tests": sorted(files)}))
')
echo "subset: ${SUBSET}"

step "Setup PMM Server"
docker network create pmm-qa || true
PWD=$(pwd) PMM_SERVER_IMAGE=${DOCKER_VERSION} docker compose -f ${DOCKER_COMPOSE_FILE} up -d || exit 1
timeout 300 bash -c 'until [ "$(curl -s -o /dev/null -w "%{http_code}" --user "admin:${ADMIN_PASSWORD}" http://127.0.0.1/v1/server/readyz)" = "200" ]; do sleep 5; done' || {
  echo "PMM Server did not become ready"; exit 1;
}
bash -x testdata/db_setup.sh
docker network connect pmm-qa pmm-server || true

step "Setup PMM-Client"
cd "${REPO_ROOT}/qa-integration/pmm_qa"
sudo bash -x pmm3-client-setup.sh --pmm_server_ip 127.0.0.1 --client_version ${PMM_CLIENT_VERSION} --admin_password ${ADMIN_PASSWORD} --use_metrics_mode no || exit 1

step "Run Setup for E2E Tests"
mkdir -m 777 -p /tmp/backup_data
export PATH_TO_PMM_QA="${REPO_ROOT}/qa-integration"
if [ "${WIZARD_ARGS}" != "-h" ]; then
  ./pmm-framework/pmm-framework --parallel --pmm-server-password=${ADMIN_PASSWORD} ${WIZARD_ARGS} || exit 1
fi

step "Execute e2e tests with tags ${TAGS_FOR_TESTS}"
cd "${REPO_ROOT}/codeceptjs-e2e"
cp pr.codecept.js /tmp/pr.codecept.js.orig
sed -i "s+http://localhost/+${PMM_UI_URL}+g" pr.codecept.js
./node_modules/.bin/codeceptjs run -c pr.codecept.js --grep "${TAGS_FOR_TESTS}" --reporter mocha-multi -o "${SUBSET}"
CODECEPT_EXIT=$?
cp /tmp/pr.codecept.js.orig pr.codecept.js
step "codecept exit code: ${CODECEPT_EXIT}"
exit ${CODECEPT_EXIT}
