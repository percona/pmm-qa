FRAMEWORK_DIR=$(cd "$(dirname "${BATS_TEST_FILENAME}")/.." && pwd)
PMM_QA_ROOT=$(cd "$FRAMEWORK_DIR/.." && pwd)
QA_INTEGRATION_ROOT=$(cd "$PMM_QA_ROOT/.." && pwd)

source "$FRAMEWORK_DIR/lib/common.sh"
source "$FRAMEWORK_DIR/lib/config.sh"
source "$FRAMEWORK_DIR/lib/cli.sh"
source "$FRAMEWORK_DIR/lib/docker.sh"
source "$FRAMEWORK_DIR/lib/images.sh"
source "$FRAMEWORK_DIR/lib/prebaked.sh"
source "$FRAMEWORK_DIR/images/mysql/setup.sh"
source "$FRAMEWORK_DIR/images/pxc/setup.sh"
source "$FRAMEWORK_DIR/images/pdpgsql/setup.sh"
source "$FRAMEWORK_DIR/images/pgsql/setup.sh"
source "$FRAMEWORK_DIR/images/psmdb/setup.sh"
source "$FRAMEWORK_DIR/images/haproxy/setup.sh"
source "$FRAMEWORK_DIR/images/external/setup.sh"
source "$FRAMEWORK_DIR/images/valkey/setup.sh"
source "$FRAMEWORK_DIR/lib/dispatch.sh"
source "$FRAMEWORK_DIR/lib/execution.sh"

reset_framework_state() {
  unset PS_VERSION MS_VERSION PSMDB_VERSION PDPGSQL_VERSION PGSQL_VERSION
  unset PXC_VERSION PROXYSQL_VERSION VALKEY_VERSION CLIENT_VERSION
  unset REDIS_VERSION NODE_PROCESS_VERSION ADMIN_PASSWORD PMM_QA_GIT_BRANCH
  DATABASE_SPECS=()
  DB_CONFIG=()
  DB_TYPE=''
  DB_VERSION=''
  PMM_SERVER_IP_ARG=''
  PMM_SERVER_PASSWORD=''
  GLOBAL_CLIENT_VERSION=''
  PMM_SERVER_HOST=pmm-server
  PMM_SERVER_PORT=8443
  PMM_SERVER_CONTAINER=''
  VERBOSE=false
  CLIENT_DEBUG=false
  PARALLEL=false
  SETUP_RETRIES=0
}

setup() {
  reset_framework_state
}
