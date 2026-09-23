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
  env | grep -E '^(PXC_.*|PGSQL_.*|SETUP_TYPE|QUERY_SOURCE|CLIENT_VERSION|PMM_SERVER_IP|ADMIN_PASSWORD)=' | sort
} >>"$RECORD_FILE"
if [[ ${PARALLEL_TEST:-false} == true ]]; then
  if [[ -n ${PXC_VERSION:-} ]]; then
    sleep 1
    echo 'PXC parallel log'
  elif [[ -n ${PGSQL_VERSION:-} ]]; then
    echo 'PGSQL parallel log'
  fi
fi
if [[ -n ${HANG_SECONDS:-} ]]; then
  echo 'setup is working'
  sleep "$HANG_SECONDS"
fi
if [[ ${FAIL_PXC:-false} == true && -n ${PXC_VERSION:-} ]]; then
  echo 'PXC failed as requested'
  exit 9
fi
if [[ -n ${FAIL_PXC_ONCE:-} && -n ${PXC_VERSION:-} ]]; then
  if [[ ! -e $FAIL_PXC_ONCE ]]; then
    : >"$FAIL_PXC_ONCE"
    echo 'PXC failed on its first attempt'
    exit 9
  fi
  echo 'PXC succeeded on its second attempt'
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
      --database pxc=8.0,QUERY_SOURCE=slowlog \
      --database pgsql=16

  [[ $status -eq 0 ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]

  first_call=$(awk '/--- call ---/{n++} n==1{print}' "$RECORD_FILE")
  second_call=$(awk '/--- call ---/{n++} n==2{print}' "$RECORD_FILE")
  [[ $first_call == *'pxc_proxysql_setup.yml'* ]]
  [[ $first_call == *'PXC_VERSION=8.0'* ]]
  [[ $first_call == *'QUERY_SOURCE=slowlog'* ]]
  [[ $first_call == *'PMM_SERVER_IP=10.0.0.5'* ]]
  [[ $second_call == *'pgsql_pgss_setup.yml'* ]]
  [[ $second_call == *'PGSQL_VERSION=16'* ]]
  [[ $second_call != *'PXC_VERSION='* ]]
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
      --database pxc=8.0 \
      --database pgsql=16

  [[ $status -eq 0 ]]
  [[ $output == *'Starting [1/2] pxc=8.0'* ]]
  [[ $output == *'Starting [2/2] pgsql=16'* ]]
  [[ $output =~ \[1/2\]\ pxc=8\.0:\ OK\ in\ [0-9ms]+\ \(log: ]]
  [[ $output =~ \[2/2\]\ pgsql=16:\ OK\ in\ [0-9ms]+\ \(log: ]]
  [[ $output == *'All 2 setups finished in '* ]]
  [[ $output != *'PXC parallel log'* ]]
  [[ $output != *'PGSQL parallel log'* ]]

  # pgsql has no artificial delay, so it should finish before sleeping pxc.
  pgsql_ok_line=$(printf '%s\n' "$output" | awk '/\[2\/2\] pgsql=16: OK/{print NR; exit}')
  pxc_ok_line=$(printf '%s\n' "$output" | awk '/\[1\/2\] pxc=8\.0: OK/{print NR; exit}')
  [[ $pgsql_ok_line -lt $pxc_ok_line ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]
}

@test "parallel mode waits for all setups and dumps only failed logs" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    FAIL_PXC=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database pxc=8.0 \
      --database pgsql=16

  [[ $status -ne 0 ]]
  [[ $output == *'===== [1/2] pxc=8.0 FAILED (exit=1) in '* ]]
  [[ $output == *'PXC failed as requested'* ]]
  [[ $output == *'[2/2] pgsql=16: OK in '* ]]
  [[ $output == *'Parallel setup logs kept at:'* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]
}

@test "a failed parallel setup is retried on its own" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    FAIL_PXC_ONCE="$BATS_TEST_TMPDIR/pxc-attempted" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --setup-retries 1 \
      --pmm-server-ip 10.0.0.5 \
      --database pxc=8.0 \
      --database pgsql=16

  [[ $status -eq 0 ]]
  [[ $output == *'===== [1/2] pxc=8.0 FAILED (exit=1) in '* ]]
  [[ $output == *'Retrying 1 failed setup(s), attempt 2 of 2'* ]]
  [[ $output == *'[1/2] pxc=8.0: OK in '* ]]
  # pgsql provisioned once: the retry must not touch a setup that succeeded.
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 3 ]]
  [[ $output != *'Parallel setup logs kept at:'* ]]
}

@test "a parallel setup that keeps failing exhausts its retries" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    FAIL_PXC=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --setup-retries 1 \
      --pmm-server-ip 10.0.0.5 \
      --database pxc=8.0 \
      --database pgsql=16

  [[ $status -ne 0 ]]
  [[ $output == *'Retrying 1 failed setup(s), attempt 2 of 2'* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 3 ]]
  [[ $output == *'Parallel setup logs kept at:'* ]]
}

@test "a failed sequential setup is retried in place" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    FAIL_PXC_ONCE="$BATS_TEST_TMPDIR/pxc-attempted" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --setup-retries 1 \
      --pmm-server-ip 10.0.0.5 \
      --database pxc=8.0 \
      --database pgsql=16

  [[ $status -eq 0 ]]
  [[ $output == *'Retrying pxc=8.0, attempt 2 of 2'* ]]
  [[ $output == *'pxc=8.0: OK in '* ]]
  [[ $output == *'pgsql=16: OK in '* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 3 ]]
}

@test "parallel mode job control emits no job-status noise" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database pxc=8.0 \
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
      --database pxc=8.0 \
      --database pgsql=16 <<<'framework-stdin-payload'

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
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]
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
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]
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
      --database pxc=8.0 \
      --database pgsql=16

  [[ $status -eq 0 ]]
  [[ $output == *'PXC parallel log'* ]]
  [[ $output == *'PGSQL parallel log'* ]]
  [[ $output == *'setup log ====='* ]]
}

@test "verbose parallel runs still dump the log of a setup that failed" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    PARALLEL_TEST=true \
    FAIL_PXC=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --verbose \
      --pmm-server-ip 10.0.0.5 \
      --database pxc=8.0 \
      --database pgsql=16

  [[ $status -ne 0 ]]
  # --verbose echoes both, but the failure keeps its own FAILED banner so it is
  # still findable among the successful logs.
  [[ $output == *'PXC failed as requested'* ]]
  [[ $output == *'FAILED (exit=1)'* ]]
  [[ $output == *'PGSQL parallel log'* ]]
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
      --database pxc=8.0 \
      --database pgsql=16 >"$out" 2>&1 &
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
  [[ $output == *'===== [1/2] pxc=8.0 INTERRUPTED ====='* ]]
  [[ $output == *'===== [2/2] pgsql=16 INTERRUPTED ====='* ]]
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
      --database pxc=8.0 >"$out" 2>&1 &
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
  [[ $output == *'===== [1/1] pxc=8.0 INTERRUPTED ====='* ]]
  [[ $(grep -c 'setup is working' "$out") -eq 1 ]]

  local log_dir
  log_dir=$(sed -n 's/^Parallel setup logs kept at: //p' "$out")
  [[ -d $log_dir ]]
  rm -rf "$log_dir"
}
