#!/usr/bin/env bats
# shellcheck disable=SC2329,SC2317  # stubs below are invoked indirectly by preflight_database_setups.

load helpers/test_helper

# preflight_database_setups() calls out to resolve_pmm_server, require_command
# and the ansible warm-up; stub them so these tests exercise only the
# parallel/sequential conflict decision.
setup() {
  reset_framework_state
  resolve_pmm_server() { :; }
  require_command() { :; }
  configure_ansible_python() { :; }
  ensure_docker_collection() { :; }
  WARNINGS=''
  log_warn() { WARNINGS+="$*"$'\n'; }
}

parallel_decision() {
  DATABASE_SPECS=("$@")
  PARALLEL=true
  preflight_database_setups
  printf '%s' "$PARALLEL"
}

@test "PSMDB replica-set, SSL PSMDB and sharded PSMDB all run in parallel" {
  [[ $(parallel_decision psmdb ssl_psmdb 'psmdb,SETUP_TYPE=sharding') == true ]]
}

@test "PSMDB replica-set and sharded run in parallel (separate compose stacks)" {
  [[ $(parallel_decision psmdb 'psmdb,SETUP_TYPE=sharding') == true ]]
  [[ $(parallel_decision 'psmdb,SETUP_TYPE=pss' 'psmdb,SETUP_TYPE=shards') == true ]]
}

@test "two replica-set PSMDB setups fall back to sequential" {
  [[ $(parallel_decision psmdb psmdb) == false ]]
  [[ $(parallel_decision 'psmdb,SETUP_TYPE=pss' 'psmdb,SETUP_TYPE=psa') == false ]]
}

@test "two sharded PSMDB setups fall back to sequential" {
  [[ $(parallel_decision 'psmdb,SETUP_TYPE=sharding' 'psmdb,SETUP_TYPE=shards') == false ]]
}

@test "two SSL PSMDB setups fall back to sequential" {
  [[ $(parallel_decision ssl_psmdb ssl_psmdb) == false ]]
}
