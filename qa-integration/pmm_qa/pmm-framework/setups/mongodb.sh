#!/usr/bin/env bash
# shellcheck disable=SC2034  # env_map is passed to run_playbook by name, so shellcheck cannot see the read.
#
# setups/mongodb.sh -- MongoDB-family setups.
#
# Two different provisioning styles live here:
#
#   PSMDB / SSL_PSMDB      docker-compose scripts under qa-integration/, driven
#                          through run_setup_script(). These want a full patch
#                          version and the PMM Server *address* (host:port).
#   MLAUNCH_* / SSL_MLAUNCH  ordinary Ansible playbooks, like every other setup.
#
# See setups/mysql.sh for the general pattern the env maps follow.

# Resolve the PSMDB version for the current spec.
#
# Precedence: PSMDB_VERSION env > spec version expanded to its newest patch >
# registered default. The middle case is why this helper exists at all: the
# compose scripts need a full version such as '8.0-12.1', so a spec version is
# sent through latest_psmdb_version() (a network lookup) rather than used
# as-is.
#
# Shared by setup_psmdb and setup_ssl_psmdb.
#
# Reads:  PSMDB_VERSION, DB_VERSION, DB_TYPE
# Stdout: the resolved version
psmdb_version() {
  if [[ -n ${PSMDB_VERSION:-} ]]; then
    printf '%s' "$PSMDB_VERSION"
  elif [[ -n $DB_VERSION ]]; then
    latest_psmdb_version "$DB_VERSION"
  else
    database_default_version "$DB_TYPE"
  fi
}

# Percona Server for MongoDB as a replica set or a sharded cluster.
#
# Script-backed rather than playbook-backed, so it needs
# PMM_SERVER_CONTAINER_ADDRESS (host:port) instead of PMM_SERVER_IP, and names
# the client version PMM_CLIENT_VERSION. TESTS/CLEANUP are pinned to 'no' --
# the scripts can run their own tests and tear down afterwards, which the
# framework never wants.
#
# SETUP_TYPE picks the script; 'shards' and 'sharding' are aliases.
#
# MINIO (default 'true') controls whether the downstream scripts start the
# shared minio/createbucket containers (used as the PBM backup store). Pass
# MINIO=false in the --database spec to skip them.
setup_psmdb() {
  local version client setup_type script
  version=$(psmdb_version)
  client=$(resolved_client_version PSMDB DB_CONFIG)
  setup_type=$(resolve_value PSMDB SETUP_TYPE DB_CONFIG)
  setup_type=${setup_type,,}

  declare -A env_map=(
    [PSMDB_VERSION]="$version"
    [PMM_SERVER_CONTAINER_ADDRESS]="$PMM_SERVER_HOST:$PMM_SERVER_PORT"
    [PSMDB_CONTAINER]="psmdb_pmm_$version"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_CLIENT_VERSION]="$client"
    [COMPOSE_PROFILES]="$(resolve_value PSMDB COMPOSE_PROFILES DB_CONFIG)"
    [MONGO_SETUP_TYPE]="$setup_type"
    [MONGO_STORAGE_ENGINE]="$(resolve_value PSMDB STORAGE_ENGINE DB_CONFIG)"
    [OL_VERSION]="$(resolve_value PSMDB OL_VERSION DB_CONFIG)"
    [GSSAPI]="$(resolve_value PSMDB GSSAPI DB_CONFIG)"
    [MINIO]="$(bool_string "$(resolve_value PSMDB MINIO DB_CONFIG)")"
    [TESTS]=no
    [CLEANUP]=no
    [CLIENT_DEBUG]="$(bool_string "$CLIENT_DEBUG")"
  )

  case "$setup_type" in
    pss|psa) script='start-rs-only.sh' ;;
    shards|sharding) script='start-sharded.sh' ;;
    *) die "Unsupported PSMDB SETUP_TYPE '$setup_type'." ;;
  esac
  run_setup_script "$QA_INTEGRATION_ROOT/pmm_psmdb-pbm_setup" "$script" env_map
}

# PSMDB launched with mlaunch instead of docker-compose.
#
# Playbook-backed, so unlike setup_psmdb it takes a plain major version and
# uses the usual PMM_SERVER_IP / CLIENT_VERSION key names.
setup_mlaunch_psmdb() {
  local version client
  version=$(resolved_version PSMDB_VERSION MLAUNCH_PSMDB "$DB_VERSION")
  client=$(resolved_client_version MLAUNCH_PSMDB DB_CONFIG)
  declare -A env_map=(
    [PSMDB_VERSION]="$version"
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [PSMDB_CONTAINER]="psmdb_pmm_$version"
    [PSMDB_SETUP]="$(resolve_value MLAUNCH_PSMDB SETUP_TYPE DB_CONFIG)"
    [CLIENT_VERSION]="$client"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
  )
  run_playbook 'mlaunch_psmdb_setup.yml' env_map
}

# Upstream MongoDB launched with mlaunch.
#
# Same as setup_mlaunch_psmdb but for MongoDB Community; note the MODB_* key
# names its playbook expects.
setup_mlaunch_modb() {
  local version client
  version=$(resolved_version MODB_VERSION MLAUNCH_MODB "$DB_VERSION")
  client=$(resolved_client_version MLAUNCH_MODB DB_CONFIG)
  declare -A env_map=(
    [MODB_VERSION]="$version"
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [MODB_CONTAINER]="modb_pmm_$version"
    [MODB_SETUP]="$(resolve_value MLAUNCH_MODB SETUP_TYPE DB_CONFIG)"
    [CLIENT_VERSION]="$client"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
  )
  run_playbook 'mlaunch_modb_setup.yml' env_map
}

# mlaunch-based MongoDB with TLS.
setup_ssl_mlaunch() {
  local version client
  version=$(resolved_version PSMDB_VERSION SSL_MLAUNCH "$DB_VERSION")
  client=$(resolved_client_version SSL_MLAUNCH DB_CONFIG)
  declare -A env_map=(
    [MONGODB_VERSION]="$version"
    [PMM_SERVER_IP]="$PMM_SERVER_HOST"
    [MONGODB_SSL_CONTAINER]="psmdb_ssl_pmm_$version"
    [CLIENT_VERSION]="$client"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_QA_GIT_BRANCH]="$(git_branch)"
  )
  run_playbook 'tls-ssl-setup/mlaunch_tls_setup.yml' env_map
}

# PSMDB with the different-authentication (TLS/Kerberos) compose stack.
#
# The most involved setup in the framework, because the tracked assets it reuses
# assume they own the whole environment. Rather than editing files under version
# control, it builds a throwaway copy in a temp directory:
#
#   * a compose override that disables the stack's own pmm-server and kerberos
#     services (the framework supplies the server), resets psmdb-server's
#     depends_on, and joins the external pmm-qa network
#   * a patched copy of test-auth.sh that loads the override and points
#     --server-address at the resolved PMM Server
#
# The override references ${ADMIN_PASSWORD} and ${PMM_SERVER_CONTAINER_ADDRESS}
# as literals -- escaped in the heredoc -- so compose expands them from the env
# map at run time and no secret is written to disk.
#
# The EXIT trap plus the SSL_PSMDB_TEMP_DIR global ensure the temp directory is
# removed even when the script fails; both are cleared on the success path.
setup_ssl_psmdb() {
  local version client directory base_script temp_dir override temp_script
  version=$(psmdb_version)
  client=$(resolved_client_version SSL_PSMDB DB_CONFIG)
  directory=$QA_INTEGRATION_ROOT/pmm_psmdb_diffauth_setup
  base_script=$directory/test-auth.sh
  temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/pmm-framework-ssl-psmdb.XXXXXX")
  override=$temp_dir/compose.yml
  temp_script=$temp_dir/test-auth.sh
  SSL_PSMDB_TEMP_DIR=$temp_dir
  trap 'rm -rf "$SSL_PSMDB_TEMP_DIR"' EXIT

  cat >"$override" <<EOF
services:
  pmm-server:
    profiles: [framework-disabled]
  kerberos:
    profiles: [framework-disabled]
  psmdb-server:
    depends_on: !reset {}
    environment:
      PMM_AGENT_SERVER_PASSWORD: "\${ADMIN_PASSWORD}"
      PMM_AGENT_SERVER_ADDRESS: "\${PMM_SERVER_CONTAINER_ADDRESS}"
    networks:
      - default
      - pmm-qa
networks:
  pmm-qa:
    external: true
    name: pmm-qa
EOF

  sed \
    -e "s|docker-compose-pmm-psmdb.yml|docker-compose-pmm-psmdb.yml -f $override|g" \
    -e "s|--server-address=pmm-server:8443|--server-address=$PMM_SERVER_HOST:$PMM_SERVER_PORT|g" \
    "$base_script" >"$temp_script"
  chmod +x "$temp_script"

  declare -A env_map=(
    [PSMDB_VERSION]="$version"
    [PMM_SERVER_CONTAINER_ADDRESS]="$PMM_SERVER_HOST:$PMM_SERVER_PORT"
    [PSMDB_CONTAINER]="psmdb_pmm_$version"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_CLIENT_VERSION]="$client"
    [COMPOSE_PROFILES]="$(resolve_value SSL_PSMDB COMPOSE_PROFILES DB_CONFIG)"
    [MONGO_SETUP_TYPE]="$(resolve_value SSL_PSMDB SETUP_TYPE DB_CONFIG)"
    [MINIO]="$(bool_string "$(resolve_value SSL_PSMDB MINIO DB_CONFIG)")"
    [TESTS]=no
    [CLEANUP]=no
  )

  # Absolute script path, but the original directory as cwd: the patched script
  # still resolves the stack's compose files relative to where they live.
  run_setup_script "$directory" "$temp_script" env_map
  rm -rf "$temp_dir"
  SSL_PSMDB_TEMP_DIR=''
  trap - EXIT
}
