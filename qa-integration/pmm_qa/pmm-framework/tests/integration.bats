#!/usr/bin/env bats

setup() {
  FRAMEWORK_DIR=$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)
  TEST_BIN="$BATS_TEST_TMPDIR/bin"
  RECORD_FILE="$BATS_TEST_TMPDIR/calls.log"
  mkdir -p "$TEST_BIN"

  cat >"$TEST_BIN/docker" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  *'test -f /etc/debian_version'*) exit 1 ;;
  *'pmm-admin status'*) printf 'Connected : true
postgres_exporter Running
node_exporter Running
' ;;
esac
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
  env | grep -E '^(PSMDB_.*|MODB_.*|SETUP_TYPE|QUERY_SOURCE|CLIENT_VERSION|PMM_SERVER_IP|ADMIN_PASSWORD)=' | sort
} >>"$RECORD_FILE"
if [[ ${PARALLEL_TEST:-false} == true ]]; then
  if [[ -n ${PSMDB_VERSION:-} ]]; then
    sleep 1
    echo 'PSMDB parallel log'
  elif [[ -n ${MODB_VERSION:-} ]]; then
    echo 'MODB parallel log'
  fi
fi
if [[ -n ${HANG_SECONDS:-} ]]; then
  echo 'setup is working'
  sleep "$HANG_SECONDS"
fi
if [[ ${FAIL_PSMDB:-false} == true && -n ${PSMDB_VERSION:-} ]]; then
  echo 'PSMDB failed as requested'
  exit 9
fi
if [[ -n ${FAIL_PSMDB_ONCE:-} && -n ${PSMDB_VERSION:-} ]]; then
  if [[ ! -e $FAIL_PSMDB_ONCE ]]; then
    : >"$FAIL_PSMDB_ONCE"
    echo 'PSMDB failed on its first attempt'
    exit 9
  fi
  echo 'PSMDB succeeded on its second attempt'
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
      --database mlaunch_psmdb=8.0,SETUP_TYPE=sharding \
      --database mlaunch_modb=7.0

  [[ $status -eq 0 ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]

  first_call=$(awk '/--- call ---/{n++} n==1{print}' "$RECORD_FILE")
  second_call=$(awk '/--- call ---/{n++} n==2{print}' "$RECORD_FILE")
  [[ $first_call == *'mlaunch_psmdb_setup.yml'* ]]
  [[ $first_call == *'PSMDB_VERSION=8.0'* ]]
  [[ $first_call == *'PSMDB_SETUP=sharding'* ]]
  [[ $first_call == *'PMM_SERVER_IP=10.0.0.5'* ]]
  [[ $second_call == *'mlaunch_modb_setup.yml'* ]]
  [[ $second_call == *'MODB_VERSION=7.0'* ]]
  [[ $second_call != *'PSMDB_VERSION='* ]]
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
      --database mlaunch_psmdb=8.0 \
      --database mlaunch_modb=7.0

  [[ $status -eq 0 ]]
  [[ $output == *'Starting [1/2] mlaunch_psmdb=8.0'* ]]
  [[ $output == *'Starting [2/2] mlaunch_modb=7.0'* ]]
  [[ $output =~ \[1/2\]\ mlaunch_psmdb=8.0:\ OK\ in\ [0-9ms]+\ \(log: ]]
  [[ $output =~ \[2/2\]\ mlaunch_modb=7.0:\ OK\ in\ [0-9ms]+\ \(log: ]]
  [[ $output == *'All 2 setups finished in '* ]]
  [[ $output != *'PSMDB parallel log'* ]]
  [[ $output != *'MODB parallel log'* ]]

  # mlaunch_modb has no artificial delay, so it should finish before sleeping mlaunch_psmdb.
  modb_ok_line=$(printf '%s\n' "$output" | awk '/\[2\/2\] mlaunch_modb=7.0: OK/{print NR; exit}')
  pdmodb_ok_line=$(printf '%s\n' "$output" | awk '/\[1\/2\] mlaunch_psmdb=8.0: OK/{print NR; exit}')
  [[ $modb_ok_line -lt $pdmodb_ok_line ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]
}

@test "parallel mode waits for all setups and dumps only failed logs" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    FAIL_PSMDB=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database mlaunch_psmdb=8.0 \
      --database mlaunch_modb=7.0

  [[ $status -ne 0 ]]
  [[ $output == *'===== [1/2] mlaunch_psmdb=8.0 FAILED (exit=1) in '* ]]
  [[ $output == *'PSMDB failed as requested'* ]]
  [[ $output == *'[2/2] mlaunch_modb=7.0: OK in '* ]]
  [[ $output == *'Parallel setup logs kept at:'* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]
}

@test "a failed parallel setup is retried on its own" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    FAIL_PSMDB_ONCE="$BATS_TEST_TMPDIR/psmdb-attempted" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --setup-retries 1 \
      --pmm-server-ip 10.0.0.5 \
      --database mlaunch_psmdb=8.0 \
      --database mlaunch_modb=7.0

  [[ $status -eq 0 ]]
  [[ $output == *'===== [1/2] mlaunch_psmdb=8.0 FAILED (exit=1) in '* ]]
  [[ $output == *'Retrying 1 failed setup(s), attempt 2 of 2'* ]]
  [[ $output == *'[1/2] mlaunch_psmdb=8.0: OK in '* ]]
  # mlaunch_modb provisioned once: the retry must not touch a setup that succeeded.
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 3 ]]
  [[ $output != *'Parallel setup logs kept at:'* ]]
}

@test "a parallel setup that keeps failing exhausts its retries" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    FAIL_PSMDB=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --setup-retries 1 \
      --pmm-server-ip 10.0.0.5 \
      --database mlaunch_psmdb=8.0 \
      --database mlaunch_modb=7.0

  [[ $status -ne 0 ]]
  [[ $output == *'Retrying 1 failed setup(s), attempt 2 of 2'* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 3 ]]
  [[ $output == *'Parallel setup logs kept at:'* ]]
}

@test "a failed sequential setup is retried in place" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    FAIL_PSMDB_ONCE="$BATS_TEST_TMPDIR/psmdb-attempted" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --setup-retries 1 \
      --pmm-server-ip 10.0.0.5 \
      --database mlaunch_psmdb=8.0 \
      --database mlaunch_modb=7.0

  [[ $status -eq 0 ]]
  [[ $output == *'Retrying mlaunch_psmdb=8.0, attempt 2 of 2'* ]]
  [[ $output == *'mlaunch_psmdb=8.0: OK in '* ]]
  [[ $output == *'mlaunch_modb=7.0: OK in '* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 3 ]]
}

@test "parallel mode job control emits no job-status noise" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database mlaunch_psmdb=8.0 \
      --database mlaunch_modb=7.0

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
      --database mlaunch_psmdb=8.0 \
      --database mlaunch_modb=7.0 <<<'framework-stdin-payload'

  [[ $status -eq 0 ]]
  [[ $(grep -c 'STDIN_EOF' "$RECORD_FILE") -eq 2 ]]
  if grep -q 'STDIN_READABLE' "$RECORD_FILE"; then
    echo 'background setup unexpectedly read framework stdin'
    return 1
  fi
}

@test "parallel mode falls back to sequential for duplicate database types" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database pgsql \
      --database pgsql,SETUP_TYPE=replication

  [[ $status -eq 0 ]]
  [[ $output == *'Running setups sequentially'* ]]
  [[ $output == *'two PGSQL setups'* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]
}

@test "parallel mode falls back to sequential for PDPGSQL and PGSQL replication" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database pdpgsql \
      --database pgsql,SETUP_TYPE=replication

  # Both setups must still run; only their concurrency is given up.
  [[ $status -eq 0 ]]
  [[ $output == *'Running setups sequentially'* ]]
  [[ $output == *'shared pgsql_cluster_data and host port 6432'* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 1 ]]
}

@test "a host conflict is refused before anything is provisioned" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database external \
      --database valkey

  # Unlike the downgrades above, rejected -- and rejected before either
  # setup started.
  [[ $status -eq 1 ]]
  [[ $output == *'EXTERNAL and VALKEY setups'* ]]
  [[ $output == *'host port 6379'* ]]
  [[ $output != *'Running setups sequentially'* ]]
  [[ ! -e "$RECORD_FILE" ]]
}

@test "parallel mode stays parallel for PDPGSQL and non-replication PGSQL" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    PARALLEL_TEST=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database pdpgsql \
      --database pgsql

  # No shared data_dir or port when PGSQL doesn't use replication, so the
  # framework must not give up concurrency for this pair.
  [[ $status -eq 0 ]]
  [[ $output != *'Running setups sequentially'* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 1 ]]
}

@test "verbose parallel runs echo the logs of successful setups" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    PARALLEL_TEST=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --verbose \
      --pmm-server-ip 10.0.0.5 \
      --database mlaunch_psmdb=8.0 \
      --database mlaunch_modb=7.0

  [[ $status -eq 0 ]]
  [[ $output == *'PSMDB parallel log'* ]]
  [[ $output == *'MODB parallel log'* ]]
  [[ $output == *'setup log ====='* ]]
}

@test "verbose parallel runs still dump the log of a setup that failed" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    PARALLEL_TEST=true \
    FAIL_PSMDB=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --verbose \
      --pmm-server-ip 10.0.0.5 \
      --database mlaunch_psmdb=8.0 \
      --database mlaunch_modb=7.0

  [[ $status -ne 0 ]]
  # --verbose echoes both, but the failure keeps its own FAILED banner so it is
  # still findable among the successful logs.
  [[ $output == *'PSMDB failed as requested'* ]]
  [[ $output == *'FAILED (exit=1)'* ]]
  [[ $output == *'MODB parallel log'* ]]
  [[ $output == *'Parallel setup logs kept at:'* ]]
}

@test "a signalled parallel run dumps the buffered logs instead of deleting them" {
  local out="$BATS_TEST_TMPDIR/signalled.out" waited=0 fw_pid fw_status=0

  env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    HANG_SECONDS=120 \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database mlaunch_psmdb=8.0 \
      --database mlaunch_modb=7.0 >"$out" 2>&1 &
  fw_pid=$!

  # Both setups must have written to their buffers before the signal, or the
  # test would pass on an empty dump.
  until [[ $(grep -c -- '--- call ---' "$RECORD_FILE" 2>/dev/null) == 2 ]]; do
    ((waited += 1))
    [[ $waited -lt 100 ]] || { kill "$fw_pid" 2>/dev/null; return 1; }
    sleep 0.2
  done
  sleep 1

  kill -TERM "$fw_pid"
  wait "$fw_pid" || fw_status=$?
  run cat "$out"

  [[ $fw_status -eq 130 ]]
  [[ $output == *'===== [1/2] mlaunch_psmdb=8.0 INTERRUPTED ====='* ]]
  [[ $output == *'===== [2/2] mlaunch_modb=7.0 INTERRUPTED ====='* ]]
  [[ $(grep -c 'setup is working' "$out") -eq 2 ]]
  [[ $output == *'Parallel setup logs kept at:'* ]]

  local log_dir
  log_dir=$(sed -n 's/^Parallel setup logs kept at: //p' "$out")
  [[ -d $log_dir ]]
  rm -rf "$log_dir"
}

@test "a signalled single-setup parallel run dumps its buffer too" {
  local out="$BATS_TEST_TMPDIR/signalled-one.out" waited=0 fw_pid fw_status=0

  env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    HANG_SECONDS=120 \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database mlaunch_psmdb=8.0 >"$out" 2>&1 &
  fw_pid=$!

  until [[ $(grep -c -- '--- call ---' "$RECORD_FILE" 2>/dev/null) == 1 ]]; do
    ((waited += 1))
    [[ $waited -lt 100 ]] || { kill "$fw_pid" 2>/dev/null; return 1; }
    sleep 0.2
  done
  sleep 1

  kill -TERM "$fw_pid"
  wait "$fw_pid" || fw_status=$?
  run cat "$out"

  [[ $fw_status -eq 130 ]]
  [[ $output == *'===== [1/1] mlaunch_psmdb=8.0 INTERRUPTED ====='* ]]
  [[ $(grep -c 'setup is working' "$out") -eq 1 ]]

  local log_dir
  log_dir=$(sed -n 's/^Parallel setup logs kept at: //p' "$out")
  [[ -d $log_dir ]]
  rm -rf "$log_dir"
}
