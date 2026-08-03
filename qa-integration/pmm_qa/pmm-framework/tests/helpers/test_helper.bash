FRAMEWORK_DIR=$(cd "$(dirname "${BATS_TEST_FILENAME}")/.." && pwd)
PMM_QA_ROOT=$(cd "$FRAMEWORK_DIR/.." && pwd)
QA_INTEGRATION_ROOT=$(cd "$PMM_QA_ROOT/.." && pwd)

source "$FRAMEWORK_DIR/lib/common.sh"
source "$FRAMEWORK_DIR/lib/config.sh"
source "$FRAMEWORK_DIR/lib/cli.sh"
source "$FRAMEWORK_DIR/lib/docker.sh"
source "$FRAMEWORK_DIR/lib/ansible.sh"
source "$FRAMEWORK_DIR/lib/runners.sh"
source "$FRAMEWORK_DIR/setups/mysql.sh"
source "$FRAMEWORK_DIR/setups/postgresql.sh"
source "$FRAMEWORK_DIR/setups/mongodb.sh"
source "$FRAMEWORK_DIR/setups/services.sh"
source "$FRAMEWORK_DIR/setups/dispatch.sh"
source "$FRAMEWORK_DIR/lib/execution.sh"

reset_framework_state() {
  unset PS_VERSION MS_VERSION PSMDB_VERSION PDPGSQL_VERSION PGSQL_VERSION
  unset PXC_VERSION PROXYSQL_VERSION VALKEY_VERSION CLIENT_VERSION
  unset REDIS_VERSION NODE_PROCESS_VERSION ADMIN_PASSWORD PMM_QA_GIT_BRANCH
  unset ANSIBLE_PYTHON_INTERPRETER PMM_FRAMEWORK_ANSIBLE_PYTHON_FALLBACK
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
  VERBOSITY_LEVEL=1
  CLIENT_DEBUG=false
  PARALLEL=false
  CAPTURE_KIND=''
  CAPTURE_TARGET=''
  CAPTURE_DIRECTORY=''
  CAPTURE_SCRIPT_CONTENT=''
  CAPTURE_OVERRIDE_CONTENT=''
  declare -gA CAPTURE_ENV=()
}

run_playbook() {
  local target=$1 map_name=$2 key
  local -n source_map=$map_name
  CAPTURE_KIND=playbook
  CAPTURE_TARGET=$target
  CAPTURE_ENV=()
  for key in "${!source_map[@]}"; do
    CAPTURE_ENV["$key"]=${source_map[$key]}
  done
}

run_setup_script() {
  local directory=$1 target=$2 map_name=$3 key
  local -n source_map=$map_name
  CAPTURE_KIND=script
  CAPTURE_DIRECTORY=$directory
  CAPTURE_TARGET=$target
  if [[ $target == /* && -f $target ]]; then
    CAPTURE_SCRIPT_CONTENT=$(<"$target")
    if [[ $CAPTURE_SCRIPT_CONTENT =~ -f[[:space:]]+([^[:space:]]+/compose.yml) ]] &&
      [[ -f ${BASH_REMATCH[1]} ]]; then
      CAPTURE_OVERRIDE_CONTENT=$(<"${BASH_REMATCH[1]}")
    fi
  fi
  CAPTURE_ENV=()
  for key in "${!source_map[@]}"; do
    CAPTURE_ENV["$key"]=${source_map[$key]}
  done
}

setup() {
  reset_framework_state
}
