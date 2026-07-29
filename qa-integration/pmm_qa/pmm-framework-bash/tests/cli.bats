#!/usr/bin/env bats

load helpers/test_helper

@test "parses repeatable database specs and global flags" {
  parse_args \
    --verbose \
    --parallel \
    --verbosity-level=2 \
    --client-version latest-tarball \
    --pmm-server-ip=10.0.0.5 \
    --database ps=8.4,SETUP_TYPE=gr \
    --database=psmdb,SETUP_TYPE=sharding

  [[ $VERBOSE == true ]]
  [[ $PARALLEL == true ]]
  [[ $VERBOSITY_LEVEL == 2 ]]
  [[ $GLOBAL_CLIENT_VERSION == latest-tarball ]]
  [[ $PMM_SERVER_IP_ARG == 10.0.0.5 ]]
  [[ ${#DATABASE_SPECS[@]} == 2 ]]
  [[ ${DATABASE_SPECS[0]} == ps=8.4,SETUP_TYPE=gr ]]
  [[ ${DATABASE_SPECS[1]} == psmdb,SETUP_TYPE=sharding ]]
}

@test "parses a database spec case-insensitively" {
  parse_database_spec 'Ps=8.4,setup_type=gr,query_source=slowlog'

  [[ $DB_TYPE == PS ]]
  [[ $DB_VERSION == 8.4 ]]
  [[ ${DB_CONFIG[SETUP_TYPE]} == gr ]]
  [[ ${DB_CONFIG[QUERY_SOURCE]} == slowlog ]]
}

@test "invalid version falls back to configured default" {
  parse_database_spec 'ps=99'

  [[ -z $DB_VERSION ]]
  [[ $(resolved_version PS_VERSION PS "$DB_VERSION") == 8.0 ]]
}

@test "value precedence is environment then global then database then default" {
  parse_database_spec 'ps,CLIENT_VERSION=from-spec,QUERY_SOURCE=slowlog'
  GLOBAL_CLIENT_VERSION=from-global
  [[ $(resolve_value PS CLIENT_VERSION DB_CONFIG) == from-global ]]
  [[ $(resolve_value PS QUERY_SOURCE DB_CONFIG) == slowlog ]]

  CLIENT_VERSION=from-env
  [[ $(resolve_value PS CLIENT_VERSION DB_CONFIG) == from-env ]]
  unset CLIENT_VERSION

  GLOBAL_CLIENT_VERSION=''
  unset 'DB_CONFIG[QUERY_SOURCE]'
  [[ $(resolve_value PS QUERY_SOURCE DB_CONFIG) == perfschema ]]
}

@test "empty exported versions fall back like Python getenv-or" {
  PS_VERSION=''
  parse_database_spec 'ps=8.4'
  [[ $(resolved_version PS_VERSION PS "$DB_VERSION") == 8.4 ]]

  DB_VERSION=''
  [[ $(resolved_version PS_VERSION PS "$DB_VERSION") == 8.0 ]]
}

@test "optional-value flags do not consume the following option" {
  parse_args \
    --pmm-server-ip \
    --pmm-server-password \
    --client-version \
    --verbosity-level \
    --database ps=8.4

  [[ -z $PMM_SERVER_IP_ARG ]]
  [[ -z $PMM_SERVER_PASSWORD ]]
  [[ -z $GLOBAL_CLIENT_VERSION ]]
  [[ $VERBOSITY_LEVEL == 1 ]]
  [[ ${DATABASE_SPECS[0]} == ps=8.4 ]]
}

@test "prebaked PS options are no longer accepted" {
  run parse_args --use-prebaked-ps --database ps=8.4
  [[ $status -ne 0 ]]
  [[ $output == *"Unknown option '--use-prebaked-ps'"* ]]

  run parse_args --prebaked-ps-image pmm-qa/ps:8.4 --database ps=8.4
  [[ $status -ne 0 ]]
  [[ $output == *"Unknown option '--prebaked-ps-image'"* ]]
}

@test "normalizes latest-tarball client version" {
  [[ $(normalize_client_version latest-tarball) == \
    'https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/pmm-client/pmm-client-latest.tar.gz' ]]
}

@test "resolves latest PSMDB patch without Python" {
  curl() {
    printf '%s\n' \
      '<option value="percona-server-mongodb-8.0-8.1|old">old</option>' \
      '<option value="percona-server-mongodb-8.0-12.1|new">new</option>'
  }

  [[ $(latest_psmdb_version 8.0) == 8.0-12.1 ]]
}

@test "selects the existing requests-capable interpreter for Ansible modules" {
  local fake_python=$BATS_TEST_TMPDIR/python
  printf '#!/usr/bin/env bash\nexit 0\n' >"$fake_python"
  chmod +x "$fake_python"
  PMM_FRAMEWORK_ANSIBLE_PYTHON_FALLBACK=$fake_python

  configure_ansible_python

  [[ $ANSIBLE_PYTHON_INTERPRETER == "$fake_python" ]]
}

@test "requires at least one database" {
  run parse_args --verbose
  [[ $status -ne 0 ]]
  [[ $output == *'At least one --database SPEC is required'* ]]
}

@test "rejects unknown global options" {
  run parse_args --not-a-real-option
  [[ $status -ne 0 ]]
  [[ $output == *"Unknown option '--not-a-real-option'"* ]]
}

@test "every versioned database pins an explicit default version" {
  local -A expected=(
    [PSMDB]=latest [SSL_PSMDB]=latest
    [MLAUNCH_PSMDB]=8.0 [MLAUNCH_MODB]=8.0 [SSL_MLAUNCH]=8.0
    [MYSQL]=9.7 [PS]=8.0 [SSL_MYSQL]=8.0
    [PGSQL]=17 [PDPGSQL]=17 [SSL_PDPGSQL]=17
    [PXC]=8.0 [PROXYSQL]=2 [VALKEY]=8
  )
  local type actual
  for type in "${!expected[@]}"; do
    actual=$(database_default_version "$type")
    if [[ $actual != "${expected[$type]}" ]]; then
      echo "$type default is '$actual', expected '${expected[$type]}'"
      return 1
    fi
  done
}

@test "default version is independent of version list order" {
  register_database ORDERTEST '9.9 1.1 5.5' 'CLIENT_VERSION' \
    'DEFAULT_VERSION=1.1' 'CLIENT_VERSION=3-dev-latest'

  [[ $(database_default_version ORDERTEST) == 1.1 ]]
}

@test "DEFAULT_VERSION is not a user-settable database option" {
  parse_database_spec 'pgsql=16,DEFAULT_VERSION=11'
  [[ $DB_VERSION == 16 ]]
  [[ -z ${DB_CONFIG[DEFAULT_VERSION]-} ]]

  DB_VERSION=''
  [[ $(resolved_version PGSQL_VERSION PGSQL "$DB_VERSION") == 17 ]]
}

# Stubs `docker ps` with the given "image<TAB>name" lines and makes the
# pmm-qa network already exist with $1 connected, so no network calls are made.
stub_docker_ps() {
  local connected=$1
  shift
  local -a rows=("$@")
  eval "docker() {
    if [[ \$1 == ps ]]; then printf '%s\n' ${rows[*]@Q}; return 0; fi
    if [[ \$1 == network && \$2 == inspect ]]; then
      [[ \$* == *--format* ]] && printf '%s\n' ${connected@Q}
      return 0
    fi
    return 0
  }"
}

@test "discovers a single PMM Server container without warning" {
  stub_docker_ps pmm-server-a $'percona/pmm-server:3\tpmm-server-a'

  run discover_pmm_server
  [[ $status -eq 0 ]]
  [[ $output != *'PMM Server containers'* ]]

  discover_pmm_server
  [[ $PMM_SERVER_CONTAINER == pmm-server-a ]]
}

@test "warns and stays deterministic when several PMM Servers are running" {
  stub_docker_ps pmm-server-a \
    $'percona/pmm-server:3\tpmm-server-a' \
    $'percona/pmm-server:2\tpmm-server-b'

  run discover_pmm_server
  [[ $status -eq 0 ]]
  [[ $output == *'Found 2 PMM Server containers'* ]]
  [[ $output == *pmm-server-a* && $output == *pmm-server-b* ]]
  [[ $output == *--pmm-server-ip* ]]

  discover_pmm_server
  [[ $PMM_SERVER_CONTAINER == pmm-server-a ]]
}

@test "reports no PMM Server when none is running" {
  stub_docker_ps '' $'mysql:8.4\tsome-db'

  run discover_pmm_server
  [[ $status -ne 0 ]]
}

@test "successful setup logs stay on disk and print only a summary" {
  local log=$BATS_TEST_TMPDIR/setup.log
  printf 'first line\nno trailing newline' >"$log"

  run print_setup_log 1 2 'ps=8.4' 0 "$log"

  [[ $status -eq 0 ]]
  [[ $output == *"[1/2] ps=8.4: OK (log: $log)"* ]]
  [[ $output != *'first line'* ]]
}

@test "failed setup logs dump to the console with END on its own line" {
  local log=$BATS_TEST_TMPDIR/setup.log
  printf 'first line\nno trailing newline' >"$log"

  run print_setup_log 1 2 'ps=8.4' 1 "$log"

  [[ $status -eq 0 ]]
  [[ $output == *'===== [1/2] ps=8.4 FAILED (exit=1) ====='* ]]
  [[ $output == *$'no trailing newline\n===== END [1/2] ps=8.4 ====='* ]]
}
