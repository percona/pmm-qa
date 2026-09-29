#!/usr/bin/env bats

load helpers/test_helper

@test "parses repeatable database specs and global flags" {
  parse_args \
    --verbose \
    --parallel \
    --setup-retries=2 \
    --client-version latest-tarball \
    --pmm-server-ip=10.0.0.5 \
    --database ps=8.4,SETUP_TYPE=gr \
    --database=psmdb,SETUP_TYPE=sharding

  [[ $VERBOSE == true ]]
  [[ $PARALLEL == true ]]
  [[ $SETUP_RETRIES == 2 ]]
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

@test "an unknown version, option or bare token is refused" {
  run parse_database_spec 'ps=99'
  [[ $status -ne 0 && $output == *"Version '99' is not supported for PS (supported: 5.7 8.0 8.4 9.7)"* ]]
  run parse_database_spec 'haproxy=1'
  [[ $status -ne 0 && $output == *"Version '1' is not supported for HAPROXY (supported: none)"* ]]
  run parse_database_spec 'ps,SETUP_TYP=gr'
  [[ $status -ne 0 && $output == *"Option 'SETUP_TYP' is not supported for PS"* ]]
  run parse_database_spec 'ps,gr'
  [[ $status -ne 0 && $output == *"Option 'gr' for PS must be KEY=VALUE"* ]]
  PS_VERSION=99 run resolved_version PS_VERSION PS ''
  [[ $status -ne 0 && $output == *"PS_VERSION='99' is not supported for PS"* ]]
}

@test "value precedence is global flag then environment then database then default" {
  parse_database_spec 'ps,CLIENT_VERSION=from-spec,QUERY_SOURCE=slowlog'
  GLOBAL_CLIENT_VERSION=from-global
  [[ $(resolve_value PS CLIENT_VERSION DB_CONFIG) == from-global ]]
  [[ $(resolve_value PS QUERY_SOURCE DB_CONFIG) == slowlog ]]

  CLIENT_VERSION=from-env
  [[ $(resolve_value PS CLIENT_VERSION DB_CONFIG) == from-global ]]

  GLOBAL_CLIENT_VERSION=''
  [[ $(resolve_value PS CLIENT_VERSION DB_CONFIG) == from-env ]]
  unset CLIENT_VERSION

  [[ $(resolve_value PS CLIENT_VERSION DB_CONFIG) == from-spec ]]

  unset 'DB_CONFIG[QUERY_SOURCE]'
  [[ $(resolve_value PS QUERY_SOURCE DB_CONFIG) == perfschema ]]
}

@test "empty exported versions fall back like Python getenv-or" {
  PS_VERSION=''
  parse_database_spec 'ps=8.4'
  [[ $(resolved_version PS_VERSION PS "$DB_VERSION") == 8.4 ]]

  DB_VERSION=''
  [[ $(resolved_version PS_VERSION PS "$DB_VERSION") == 8.4 ]]
}

@test "optional-value flags do not consume the following option" {
  parse_args \
    --pmm-server-ip \
    --pmm-server-password \
    --client-version \
    --setup-retries \
    --database ps=8.4

  [[ -z $PMM_SERVER_IP_ARG ]]
  [[ -z $PMM_SERVER_PASSWORD ]]
  [[ -z $GLOBAL_CLIENT_VERSION ]]
  [[ $SETUP_RETRIES == 0 ]]
  [[ ${DATABASE_SPECS[0]} == ps=8.4 ]]
}

@test "normalizes latest-tarball client version on x86_64" {
  # shellcheck disable=SC2329,SC2317
  uname() { printf 'x86_64\n'; }

  [[ $(normalize_client_version latest-tarball) == \
    'https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/pmm-client/pmm-client-latest.tar.gz' ]]
}

@test "normalizes latest-tarball client version on arm64" {
  # shellcheck disable=SC2329,SC2317
  uname() { printf 'aarch64\n'; }

  [[ $(normalize_client_version latest-tarball) == \
    'https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/pmm-client-arm/pmm-client-latest.tar.gz' ]]
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

@test "DEFAULT_VERSION is not a user-settable database option" {
  run parse_database_spec 'pgsql=16,DEFAULT_VERSION=11'
  [[ $status -ne 0 && $output == *"Option 'DEFAULT_VERSION' is not supported for PGSQL"* ]]

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

  run print_setup_log 1 2 'ps=8.4' 0 "$log" 452

  [[ $status -eq 0 ]]
  [[ $output == *"[1/2] ps=8.4: OK in 7m32s (log: $log)"* ]]
  [[ $output != *'first line'* ]]
}

@test "verbose echoes the logs of setups that succeeded" {
  local log=$BATS_TEST_TMPDIR/setup.log
  printf 'first line\nno trailing newline' >"$log"
  VERBOSE=true

  run print_setup_log 1 2 'ps=8.4' 0 "$log"

  [[ $status -eq 0 ]]
  [[ $output == *"[1/2] ps=8.4: OK (log: $log)"* ]]
  [[ $output == *$'no trailing newline\n===== END [1/2] ps=8.4 ====='* ]]
}

@test "failed setup logs dump to the console with END on its own line" {
  local log=$BATS_TEST_TMPDIR/setup.log
  printf 'first line\nno trailing newline' >"$log"

  run print_setup_log 1 2 'ps=8.4' 1 "$log" 45

  [[ $status -eq 0 ]]
  [[ $output == *'===== [1/2] ps=8.4 FAILED (exit=1) in 45s ====='* ]]
  [[ $output == *$'no trailing newline\n===== END [1/2] ps=8.4 ====='* ]]
}

@test "format_duration renders seconds below a minute and mm/ss above" {
  [[ $(format_duration 0) == '0s' ]]
  [[ $(format_duration 45) == '45s' ]]
  [[ $(format_duration 59) == '59s' ]]
  [[ $(format_duration 60) == '1m00s' ]]
  [[ $(format_duration 452) == '7m32s' ]]
  [[ $(format_duration 3142) == '52m22s' ]]
}

@test "a successful prebaked setup echoes its agents' states" {
  local log=$BATS_TEST_TMPDIR/setup.log
  printf '%s\n' '==> Run workload' 'agent-status pxc_proxysql_pmm_8.4: node_exporter  Running  42001' 'noise' >"$log"

  run print_setup_log 1 1 'pxc' 0 "$log" 70

  [[ $status -eq 0 ]]
  [[ ${lines[0]} == "[1/1] pxc: OK in 1m10s (log: $log)" ]]
  [[ ${lines[1]} == '  pxc_proxysql_pmm_8.4: node_exporter  Running  42001' ]]
  [[ $output != *noise* ]]
}

