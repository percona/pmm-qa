#!/usr/bin/env bats

setup() {
  FRAMEWORK_DIR=$(cd "$(dirname "$BATS_TEST_FILENAME")/.." && pwd)
  TEST_BIN="$BATS_TEST_TMPDIR/bin"
  RECORD_FILE="$BATS_TEST_TMPDIR/calls.log"
  mkdir -p "$TEST_BIN"

  # A fake docker that answers the probes the HAProxy and PGSQL setups poll.
  # Each `docker run` of a setup's container is one "call", where the knobs
  # below make that setup slow, fail or hang.
  cat >"$TEST_BIN/docker" <<'EOF'
#!/usr/bin/env bash
case "$*" in
  *'test -f /etc/debian_version'*) exit 1 ;;
  *pg_stat_replication*) echo 1 ;;
  *'pmm-admin status'*) printf '%s\n' 'Connected : true' 'postgres_exporter Running' 'node_exporter Running' ;;
  *'pmm-agent setup'*) printf 'agent: %s\n' "$*" >>"$RECORD_FILE" ;;
  'run --detach --name '*)
    name=$4
    [[ $name == haproxy_pmm || $name == pgsql_pgss_pmm_* ]] || exit 0
    printf -- '--- call --- %s\n' "$name" >>"$RECORD_FILE"
    if [[ ${STDIN_PROBE:-false} == true ]]; then
      if read -r line; then echo "STDIN_READABLE:$line" >>"$RECORD_FILE"; else echo STDIN_EOF >>"$RECORD_FILE"; fi
    fi
    if [[ ${PARALLEL_TEST:-false} == true ]]; then
      if [[ $name == haproxy_pmm ]]; then
        sleep 1
        echo 'HAPROXY parallel log' >&2
      else
        echo 'PGSQL parallel log' >&2
      fi
    fi
    if [[ -n ${HANG_SECONDS:-} ]]; then
      echo 'setup is working' >&2
      sleep "$HANG_SECONDS"
    fi
    if [[ $name == haproxy_pmm ]]; then
      if [[ ${FAIL_HAPROXY:-false} == true ]]; then
        echo 'HAPROXY failed as requested' >&2
        exit 9
      fi
      if [[ -n ${FAIL_HAPROXY_ONCE:-} ]]; then
        if [[ ! -e $FAIL_HAPROXY_ONCE ]]; then
          : >"$FAIL_HAPROXY_ONCE"
          echo 'HAPROXY failed on its first attempt' >&2
          exit 9
        fi
        echo 'HAPROXY succeeded on its second attempt' >&2
      fi
    fi
    ;;
esac
exit 0
EOF
  cat >"$TEST_BIN/curl" <<'EOF'
#!/usr/bin/env bash
while (($#)); do
  if [[ $1 == -o ]]; then
    echo 'fake PMM Client tarball' >"$2"
  fi
  shift
done
EOF
  chmod +x "$TEST_BIN"/*
}

@test "entrypoint provisions multiple databases in order against the given server" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    XDG_CACHE_HOME="$BATS_TEST_TMPDIR/cache" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --pmm-server-ip 10.0.0.5 \
      --pmm-server-password secret \
      --client-version latest-tarball \
      --database haproxy \
      --database pgsql=16

  [[ $status -eq 0 ]]
  [[ $(grep -- '--- call ---' "$RECORD_FILE" | tr '\n' ' ') == '--- call --- haproxy_pmm --- call --- pgsql_pgss_pmm_16 ' ]]
  [[ $(grep -c -- 'agent: .*--server-address=10.0.0.5:443 .*--server-password=secret ' "$RECORD_FILE") -eq 2 ]]
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
      --database haproxy \
      --database pgsql=17

  [[ $status -eq 0 ]]
  [[ $output == *'Starting [1/2] haproxy'* ]]
  [[ $output == *'Starting [2/2] pgsql=17'* ]]
  [[ $output =~ \[1/2\]\ haproxy:\ OK\ in\ [0-9ms]+\ \(log: ]]
  [[ $output =~ \[2/2\]\ pgsql=17:\ OK\ in\ [0-9ms]+\ \(log: ]]
  [[ $output == *'All 2 setups finished in '* ]]
  [[ $output != *'HAPROXY parallel log'* ]]
  [[ $output != *'PGSQL parallel log'* ]]

  # pgsql has no artificial delay, so it should finish before the sleeping haproxy.
  pgsql_ok_line=$(printf '%s\n' "$output" | awk '/\[2\/2\] pgsql=17: OK/{print NR; exit}')
  haproxy_ok_line=$(printf '%s\n' "$output" | awk '/\[1\/2\] haproxy: OK/{print NR; exit}')
  [[ $pgsql_ok_line -lt $haproxy_ok_line ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]
}

@test "parallel mode waits for all setups and dumps only failed logs" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    FAIL_HAPROXY=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database haproxy \
      --database pgsql=17

  [[ $status -ne 0 ]]
  [[ $output == *'===== [1/2] haproxy FAILED (exit=1) in '* ]]
  [[ $output == *'HAPROXY failed as requested'* ]]
  [[ $output == *'[2/2] pgsql=17: OK in '* ]]
  [[ $output == *'Parallel setup logs kept at:'* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]
}

@test "a failed parallel setup is retried on its own" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    FAIL_HAPROXY_ONCE="$BATS_TEST_TMPDIR/haproxy-attempted" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --setup-retries 1 \
      --pmm-server-ip 10.0.0.5 \
      --database haproxy \
      --database pgsql=17

  [[ $status -eq 0 ]]
  [[ $output == *'===== [1/2] haproxy FAILED (exit=1) in '* ]]
  [[ $output == *'Retrying 1 failed setup(s), attempt 2 of 2'* ]]
  [[ $output == *'[1/2] haproxy: OK in '* ]]
  # pgsql provisioned once: the retry must not touch a setup that succeeded.
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 3 ]]
  [[ $output != *'Parallel setup logs kept at:'* ]]
}

@test "a parallel setup that keeps failing exhausts its retries" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    FAIL_HAPROXY=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --setup-retries 1 \
      --pmm-server-ip 10.0.0.5 \
      --database haproxy \
      --database pgsql=17

  [[ $status -ne 0 ]]
  [[ $output == *'Retrying 1 failed setup(s), attempt 2 of 2'* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 3 ]]
  [[ $output == *'Parallel setup logs kept at:'* ]]
}

@test "a failed sequential setup is retried in place" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    FAIL_HAPROXY_ONCE="$BATS_TEST_TMPDIR/haproxy-attempted" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --setup-retries 1 \
      --pmm-server-ip 10.0.0.5 \
      --database haproxy \
      --database pgsql=17

  [[ $status -eq 0 ]]
  [[ $output == *'Retrying haproxy, attempt 2 of 2'* ]]
  [[ $output == *'haproxy: OK in '* ]]
  [[ $output == *'pgsql=17: OK in '* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 3 ]]
}

@test "parallel mode job control emits no job-status noise" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database haproxy \
      --database pgsql=17

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
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    STDIN_PROBE=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database haproxy \
      --database pgsql=17 <<<'framework-stdin-payload'

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
      --database haproxy \
      --database haproxy

  [[ $status -eq 0 ]]
  [[ $output == *'Running setups sequentially'* ]]
  [[ $output == *'two HAPROXY setups'* ]]
  [[ $(grep -c -- '--- call ---' "$RECORD_FILE") -eq 2 ]]
}

@test "PDPGSQL patroni and PGSQL replication cannot share a host" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database pdpgsql,SETUP_TYPE=patroni \
      --database pgsql,SETUP_TYPE=replication

  [[ $status -eq 1 ]]
  [[ $output == *'both publish host port 6432'* ]]
  [[ $output != *'Running setups sequentially'* ]]
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

@test "parallel mode stays parallel for PDPGSQL and PGSQL replication" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --pmm-server-ip 10.0.0.5 \
      --database pdpgsql \
      --database pgsql,SETUP_TYPE=replication

  # Single-node PDPGSQL publishes 5432 and replication PGSQL 6432-6433, and
  # neither keeps data on the host.
  [[ $status -eq 0 ]]
  [[ $output != *'Running setups sequentially'* ]]
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
      --database haproxy \
      --database pgsql=17

  [[ $status -eq 0 ]]
  [[ $output == *'HAPROXY parallel log'* ]]
  [[ $output == *'PGSQL parallel log'* ]]
  [[ $output == *'setup log ====='* ]]
}

@test "verbose parallel runs still dump the log of a setup that failed" {
  run env \
    PATH="$TEST_BIN:$PATH" \
    RECORD_FILE="$RECORD_FILE" \
    PARALLEL_TEST=true \
    FAIL_HAPROXY=true \
    "$FRAMEWORK_DIR/pmm-framework" \
      --parallel \
      --verbose \
      --pmm-server-ip 10.0.0.5 \
      --database haproxy \
      --database pgsql=17

  [[ $status -ne 0 ]]
  # --verbose echoes both, but the failure keeps its own FAILED banner so it is
  # still findable among the successful logs.
  [[ $output == *'HAPROXY failed as requested'* ]]
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
      --database haproxy \
      --database pgsql=17 >"$out" 2>&1 &
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
  [[ $output == *'===== [1/2] haproxy INTERRUPTED ====='* ]]
  [[ $output == *'===== [2/2] pgsql=17 INTERRUPTED ====='* ]]
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
      --database haproxy >"$out" 2>&1 &
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
  [[ $output == *'===== [1/1] haproxy INTERRUPTED ====='* ]]
  [[ $(grep -c 'setup is working' "$out") -eq 1 ]]

  local log_dir
  log_dir=$(sed -n 's/^Parallel setup logs kept at: //p' "$out")
  [[ -d $log_dir ]]
  rm -rf "$log_dir"
}
