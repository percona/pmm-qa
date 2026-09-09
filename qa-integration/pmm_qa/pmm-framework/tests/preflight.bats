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

# For the host-conflict cases, which die() rather than downgrading: `run` keeps
# the exit status and the stderr message where the assertions can see them.
preflight_run() {
  DATABASE_SPECS=("$@")
  PARALLEL=true
  run preflight_database_setups
}

@test "PSMDB and SSL PSMDB run in parallel" {
  [[ $(parallel_decision psmdb ssl_psmdb) == true ]]
}

@test "PSMDB replica-set and sharded cannot share a host" {
  for specs in 'psmdb psmdb,SETUP_TYPE=sharding' 'psmdb,SETUP_TYPE=sharding psmdb'; do
    # shellcheck disable=SC2086  # each half of $specs is one --database spec.
    preflight_run $specs
    [[ $status -eq 1 ]]
    [[ $output == *'two PSMDB setups'* ]]
    [[ $output == *'rs101..rs203 and host port 27027'* ]]
    [[ $output == *'separate machines'* ]]
  done
}

@test "two PSMDB setups of the same class cannot share a host" {
  preflight_run psmdb psmdb
  [[ $status -eq 1 ]]
  [[ $output == *'two PSMDB setups'* ]]

  preflight_run 'psmdb,SETUP_TYPE=pss' 'psmdb,SETUP_TYPE=psa'
  [[ $status -eq 1 ]]
  [[ $output == *'two PSMDB setups'* ]]

  preflight_run 'psmdb,SETUP_TYPE=sharding' 'psmdb,SETUP_TYPE=shards'
  [[ $status -eq 1 ]]
  [[ $output == *'two PSMDB setups'* ]]
}

@test "a PSMDB host conflict is caught behind an unrelated spec" {
  preflight_run ps psmdb valkey 'psmdb,SETUP_TYPE=sharding'
  [[ $status -eq 1 ]]
  [[ $output == *'two PSMDB setups'* ]]
}

@test "two SSL PSMDB setups fall back to sequential" {
  [[ $(parallel_decision ssl_psmdb ssl_psmdb) == false ]]
}

@test "EXTERNAL and VALKEY cannot share a host" {
  for specs in 'external valkey' 'valkey external'; do
    # shellcheck disable=SC2086  # each half of $specs is one --database spec.
    preflight_run $specs
    [[ $status -eq 1 ]]
    [[ $output == *'EXTERNAL and VALKEY setups'* ]]
    [[ $output == *'host port 6379'* ]]
    [[ $output == *'separate machines'* ]]
  done
}

@test "EXTERNAL and VALKEY each parallelize with other setups" {
  [[ $(parallel_decision external haproxy pdpgsql) == true ]]
  [[ $(parallel_decision valkey haproxy pdpgsql) == true ]]
}

# The five shards of nightly-e2e-tests-matrix.yml, verbatim. Each one has to
# stay genuinely parallel: a shard that silently downgrades to sequential pays
# the sum of its setups instead of its slowest one, which is the whole reason
# the shards were grouped.
@test "every nightly setup shard provisions in parallel" {
  [[ $(parallel_decision mysql 'psmdb,SETUP_TYPE=pss' pgsql) == true ]]
  [[ $(parallel_decision 'ps,SETUP_TYPE=gr' pxc valkey) == true ]]
  [[ $(parallel_decision 'ps,SETUP_TYPE=replication' 'psmdb,SETUP_TYPE=sharding') == true ]]
  [[ $(parallel_decision 'ps,QUERY_SOURCE=slowlog,MY_ROCKS=true' 'pdpgsql,SETUP_TYPE=patroni' external) == true ]]
  [[ $(parallel_decision pxc pdpgsql haproxy) == true ]]
}
