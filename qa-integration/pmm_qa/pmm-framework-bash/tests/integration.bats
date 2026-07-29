#!/usr/bin/env bats

setup() {
  FRAMEWORK_DIR=$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)
  TEST_BIN="$BATS_TEST_TMPDIR/bin"
  RECORD_FILE="$BATS_TEST_TMPDIR/calls.log"
  mkdir -p "$TEST_BIN"

  cat >"$TEST_BIN/docker" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
  cat >"$TEST_BIN/ansible-galaxy" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
  cat >"$TEST_BIN/ansible-playbook" <<'EOF'
#!/usr/bin/env bash
{
  echo '--- call ---'
  printf 'args='
  printf '%q ' "$@"
  echo
  env | grep -E '^(PS_.*|PGSQL_.*|SETUP_TYPE|QUERY_SOURCE|CLIENT_VERSION|PMM_SERVER_IP|ADMIN_PASSWORD)=' | sort
} >>"$RECORD_FILE"
if [[ ${PARALLEL_TEST:-false} == true ]]; then
  if [[ -n ${PS_VERSION:-} ]]; then
    sleep 1
    echo 'PS parallel log'
  elif [[ -n ${PGSQL_VERSION:-} ]]; then
    echo 'PGSQL parallel log'
  fi
fi
if [[ ${FAIL_PS:-false} == true && -n ${PS_VERSION:-} ]]; then
  echo 'PS failed as requested'
  exit 9
fi
EOF
  cat >"$TEST_BIN/curl" <<'EOF'
#!/usr/bin/env bash
printf '<option value="percona-server-mongodb-8.0-12.1|fixture">8.0-12.1</option>\n'
EOF
  chmod +x "$TEST_BIN"/*
}

@test "entrypoint dispatches multiple databases in order through ansible-playbook" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --pmm-server-ip 10.0.0.5 \
      --pmm-server-password secret \
      --client-version latest-tarball \
      --database ps=8.4,SETUP_TYPE=gr,QUERY_SOURCE=slowlog \
      --database pgsql=16

  [[ $status -eq 0 ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]

  first_call=$(awk '/--- call ---/{n++} n==1{print}' "$RECORD_FILE")
  second_call=$(awk '/--- call ---/{n++} n==2{print}' "$RECORD_FILE")
  [[ $first_call == *'percona_server_for_mysql/percona-server-setup.yml'* ]]
  [[ $first_call == *'PS_VERSION=8.4'* ]]
  [[ $first_call == *'SETUP_TYPE=gr'* ]]
  [[ $first_call == *'QUERY_SOURCE=slowlog'* ]]
  [[ $first_call == *'PMM_SERVER_IP=10.0.0.5'* ]]
  [[ $second_call == *'pgsql_pgss_setup.yml'* ]]
  [[ $second_call == *'PGSQL_VERSION=16'* ]]
  [[ $second_call != *'PS_VERSION='* ]]
}

@test "entrypoint reports invalid database without calling backends" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --pmm-server-ip 10.0.0.5 \
      --database no-such-db

  [[ $status -ne 0 ]]
  [[ $output == *"Database type 'no-such-db' is not recognized"* ]]
  [[ ! -f $RECORD_FILE ]]
}

@test "parallel mode reports successes as they finish without dumping logs" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    PARALLEL_TEST=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database ps=8.4 \
      --database pgsql=16

  [[ $status -eq 0 ]]
  [[ $output == *'Starting [1/2] ps=8.4'* ]]
  [[ $output == *'Starting [2/2] pgsql=16'* ]]
  [[ $output == *'[1/2] ps=8.4: OK (log:'* ]]
  [[ $output == *'[2/2] pgsql=16: OK (log:'* ]]
  [[ $output != *'PS parallel log'* ]]
  [[ $output != *'PGSQL parallel log'* ]]

  # pgsql has no artificial delay, so it should finish before sleeping ps.
  pgsql_ok_line=$(printf '%s\n' "$output" | awk '/\[2\/2\] pgsql=16: OK/{print NR; exit}')
  ps_ok_line=$(printf '%s\n' "$output" | awk '/\[1\/2\] ps=8\.4: OK/{print NR; exit}')
  [[ $pgsql_ok_line -lt $ps_ok_line ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]
}

@test "parallel mode waits for all setups and dumps only failed logs" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    FAIL_PS=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database ps=8.4 \
      --database pgsql=16

  [[ $status -ne 0 ]]
  [[ $output == *'===== [1/2] ps=8.4 FAILED (exit=1) ====='* ]]
  [[ $output == *'PS failed as requested'* ]]
  [[ $output == *'[2/2] pgsql=16: OK (log:'* ]]
  [[ $output == *'Parallel setup logs kept at:'* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]
}

@test "parallel mode job control emits no job-status noise" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database ps=8.4 \
      --database pgsql=16

  [[ $status -eq 0 ]]
  # `set -m` in run_parallel_setups must not leak "[1]+ Done ..." lines.
  if grep -qE '^\[[0-9]+\][-+]?[[:space:]]' <<<"$output"; then
    echo "job-control notifications leaked into parallel output"
    return 1
  fi
}

@test "parallel setups run with stdin detached" {
  # Under job control a background setup that reads the terminal is stopped by
  # SIGTTIN and never finishes, so each job must get /dev/null on stdin.
  # Successful parallel runs no longer dump setup stdout, so record the probe
  # result outside the buffered console log.
  cat >"$TEST_BIN/ansible-playbook" <<'EOF'
#!/usr/bin/env bash
if read -r line; then
  echo "STDIN_READABLE:$line" >>"$RECORD_FILE"
else
  echo "STDIN_EOF" >>"$RECORD_FILE"
fi
EOF
  chmod +x "$TEST_BIN/ansible-playbook"

  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database ps=8.4 \
      --database pgsql=16 <<<'framework-stdin-payload'

  [[ $status -eq 0 ]]
  [[ $(grep -c 'STDIN_EOF' "$RECORD_FILE") -eq 2 ]]
  if grep -q 'STDIN_READABLE' "$RECORD_FILE"; then
    echo 'background setup unexpectedly read framework stdin'
    return 1
  fi
}

@test "parallel mode rejects PS and MySQL shared resources" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database ps=8.4 \
      --database mysql=8.4

  [[ $status -ne 0 ]]
  [[ $output == *'share mysql_cluster_data and host ports'* ]]
  [[ ! -f $RECORD_FILE ]]
}
