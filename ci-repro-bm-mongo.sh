#!/bin/bash
# Local reproduction of .github/workflows/runner-e2e-tests-codeceptjs.yml for @bm-mongo.
# Mirrors the CI steps, order and environment so failures reproduce faithfully.
set -o pipefail

REPO_ROOT=$(cd "$(dirname "$0")" && pwd)

export ADMIN_PASSWORD='admin-password'
export DOCKER_VERSION="${DOCKER_VERSION:-perconalab/pmm-server:3-dev-latest}"
export DOCKER_COMPOSE_FILE='docker-compose.yml'
export PMM_CLIENT_VERSION='latest-tarball'
export CLIENT_VERSION='latest-tarball'
export WIZARD_ARGS='--database psmdb,SETUP_TYPE=pss,COMPOSE_PROFILES=extra'
export TAGS_FOR_TESTS='@bm-mongo'
export GSSAPI_ENABLED='false'
export SERVER_IP='127.0.0.1'
export PMM_UI_URL='http://127.0.0.1/'
export PMM_URL="http://admin:${ADMIN_PASSWORD}@${SERVER_IP}"

# Launchable subset produced by CI with 100% confidence (order matters).
SUBSET='{"tests": ["tests/backup/inventory_test.js", "tests/backup/scheduled_test.js"]}'

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
./pmm-framework/pmm-framework --parallel --pmm-server-password=${ADMIN_PASSWORD} ${WIZARD_ARGS} || exit 1

step "Execute e2e tests with tags ${TAGS_FOR_TESTS}"
cd "${REPO_ROOT}/codeceptjs-e2e"
cp pr.codecept.js /tmp/pr.codecept.js.orig
sed -i "s+http://localhost/+${PMM_UI_URL}+g" pr.codecept.js
./node_modules/.bin/codeceptjs run -c pr.codecept.js --grep "${TAGS_FOR_TESTS}" --reporter mocha-multi -o "${SUBSET}"
CODECEPT_EXIT=$?
cp /tmp/pr.codecept.js.orig pr.codecept.js
step "codecept exit code: ${CODECEPT_EXIT}"
exit ${CODECEPT_EXIT}
