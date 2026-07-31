#!/usr/bin/env bash
#
# MicroVM overrides for the bash pmm-framework.
#
# Ansible playbooks are merged into PMM_QA_ROOT at entrypoint startup.
# Script-backed MongoDB setups use no-systemd compose under cursor-qa-integration/.

# Percona Server for MongoDB — MicroVM compose scripts (no systemd/cgroup).
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
    [TESTS]=no
    [CLEANUP]=no
    [CLIENT_DEBUG]="$(bool_string "$CLIENT_DEBUG")"
    [IS_CURSOR_VM]=1
    [PMM_QA_NO_SYSTEMD]=1
  )

  case "$setup_type" in
    pss|psa) script='start-rs-only-microvm.sh' ;;
    shards|sharding) script='start-sharded-microvm.sh' ;;
    *) die "Unsupported PSMDB SETUP_TYPE '$setup_type'." ;;
  esac
  run_setup_script "$PMM_QA_CURSOR_PSMDB_ROOT" "$script" env_map
}

# PSMDB different-auth stack — cursor test-auth.sh + microvm compose overlay.
setup_ssl_psmdb() {
  local version client
  version=$(psmdb_version)
  client=$(resolved_client_version SSL_PSMDB DB_CONFIG)

  declare -A env_map=(
    [PSMDB_VERSION]="$version"
    [PMM_SERVER_CONTAINER_ADDRESS]="$PMM_SERVER_HOST:$PMM_SERVER_PORT"
    [PSMDB_CONTAINER]="psmdb_pmm_$version"
    [ADMIN_PASSWORD]="$(admin_password)"
    [PMM_CLIENT_VERSION]="$client"
    [COMPOSE_PROFILES]="$(resolve_value SSL_PSMDB COMPOSE_PROFILES DB_CONFIG)"
    [MONGO_SETUP_TYPE]="$(resolve_value SSL_PSMDB SETUP_TYPE DB_CONFIG)"
    [TESTS]=no
    [CLEANUP]=no
    [IS_CURSOR_VM]=1
    [PMM_QA_NO_SYSTEMD]=1
  )

  run_setup_script "$PMM_QA_CURSOR_DIFFAUTH_ROOT" 'test-auth.sh' env_map
}
