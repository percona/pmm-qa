#!/usr/bin/env bash
#
# MicroVM overrides for the bash pmm-framework.
#
# Ansible playbooks are merged into PMM_QA_ROOT at entrypoint startup.
# PSMDB shell scripts are patched at runtime from qa-integration/ (no forked
# start-rs-only-microvm.sh); only compose overlays and no-systemd helpers live
# under cursor-qa-integration/pmm_psmdb-pbm_setup/.

  _psmdb_microvm_script_header() {
  local qa_psmdb=$1 cursor_psmdb=$2
  cat <<EOF
#!/bin/bash
set -euo pipefail
PMM_QA_PSMDB_ROOT='$qa_psmdb'
PMM_QA_PSMDB_MICROVM_ROOT='$cursor_psmdb'
export PMM_QA_PSMDB_ROOT PMM_QA_PSMDB_MICROVM_ROOT
export MONGOD_RS_CONFIG_DIR="\${MONGOD_RS_CONFIG_DIR:-\$PMM_QA_PSMDB_ROOT/conf/mongod-rs}"
# shellcheck source=/dev/null
source "\$PMM_QA_PSMDB_MICROVM_ROOT/scripts/compose-env.sh"
EOF
}

# Patch a qa-integration PSMDB script: source compose-env + use compose_rs/sharded.
patch_psmdb_script_for_microvm() {
  local source=$1 dest=$2 qa_psmdb=$3 cursor_psmdb=$4
  _psmdb_microvm_script_header "$qa_psmdb" "$cursor_psmdb" >"$dest"
  tail -n +2 "$source" | sed \
    -e 's|docker compose -f docker-compose-rs.yaml|compose_rs|g' \
    -e 's|docker compose -f docker-compose-sharded.yaml|compose_sharded|g' \
    -e 's| systemctl | /usr/local/bin/systemctl |g' \
    >>"$dest"
  chmod +x "$dest"
}

# Replica-set configure-agents needs manual pmm-agent start without systemd PID 1.
patch_configure_agents_for_microvm() {
  local script=$1
  if grep -q 'entrypoint-no-systemd.sh start-pmm-agent' "$script"; then
    return 0
  fi
  sed -i '/compose_rs exec -T -e PMM_AGENT_SETUP_NODE_NAME/i\
    if is_cursor_vm; then\
      compose_rs exec -T $node /entrypoint-no-systemd.sh start-pmm-agent\
      sleep 2\
    fi' "$script"
}

# Sharded starter configures pmm-agent inline (no separate configure-agents.sh).
patch_sharded_starter_for_microvm() {
  local script=$1
  if grep -q 'entrypoint-no-systemd.sh start-pmm-agent' "$script"; then
    return 0
  fi
  sed -i '/compose_sharded exec -T -e PMM_AGENT_SETUP_NODE_NAME/i\
    compose_sharded exec -T $node /entrypoint-no-systemd.sh start-pmm-agent\
    sleep 2' "$script"
}

# Percona Server for MongoDB — runtime-patched qa-integration scripts + MicroVM compose overlay.
setup_psmdb() {
  local version client setup_type script qa_psmdb cursor_psmdb temp_dir escaped_temp_dir cfg
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
    pss|psa) script='start-rs-only.sh' ;;
    shards|sharding) script='start-sharded.sh' ;;
    *) die "Unsupported PSMDB SETUP_TYPE '$setup_type'." ;;
  esac

  qa_psmdb="$QA_INTEGRATION_ROOT/pmm_psmdb-pbm_setup"
  cursor_psmdb="$PMM_QA_CURSOR_PSMDB_ROOT"
  temp_dir=$(mktemp -d "${TMPDIR:-/tmp}/pmm-psmdb-microvm.XXXXXX")

  for cfg in configure-replset.sh configure-psa.sh configure-agents.sh \
    configure-extra-replset.sh configure-extra-psa.sh configure-extra-agents.sh; do
    if [[ -f $qa_psmdb/$cfg ]]; then
      patch_psmdb_script_for_microvm "$qa_psmdb/$cfg" "$temp_dir/$cfg" "$qa_psmdb" "$cursor_psmdb"
      if [[ $cfg == configure-agents.sh ]]; then
        patch_configure_agents_for_microvm "$temp_dir/$cfg"
      fi
    fi
  done

  patch_psmdb_script_for_microvm "$qa_psmdb/$script" "$temp_dir/$script" "$qa_psmdb" "$cursor_psmdb"
  if [[ $script == start-sharded.sh ]]; then
    patch_sharded_starter_for_microvm "$temp_dir/$script"
  fi

  escaped_temp_dir=$(printf '%s\n' "$temp_dir" | sed 's/[&/\]/\\&/g')
  sed -i -E "s|\\./configure-([^ ]+\\.sh)|${escaped_temp_dir}/configure-\\1|g" "$temp_dir/$script"

  run_setup_script "$qa_psmdb" "$temp_dir/$script" env_map
  rm -rf "$temp_dir"
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
