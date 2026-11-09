#!/usr/bin/env bash
#
# lib/execution.sh -- preflight, then sequential or parallel setups.
# ARCHITECTURE.md §3 covers both strategies and the conflict rules.

# Fails a bad request in seconds instead of halfway through provisioning.
# Same-type or PS+MYSQL pairs only lose concurrency; pairs that hold the same
# container name or host port while up are refused.
preflight_database_setups() {
  local spec
  local mysql_data_owner='' conflict='' host_conflict='' setup_type
  local patroni_seen=false pgsql_replication_seen=false
  local external_seen=false valkey_seen=false
  local redis_port_conflict='EXTERNAL and VALKEY setups (both publish host port 6379)'
  local pg_port_conflict='PDPGSQL (patroni) and PGSQL (replication) setups (both publish host port 6432)'
  declare -A seen_types=()

  for spec in "${DATABASE_SPECS[@]}"; do
    parse_database_spec "$spec"

    # Separate compose projects do not isolate PSMDB: both stacks pin
    # container_name rs101..rs203 and host port 27027.
    if [[ -v "seen_types[$DB_TYPE]" ]]; then
      if [[ $DB_TYPE == PSMDB ]]; then
        host_conflict='two PSMDB setups (both compose stacks pin container names rs101..rs203 and host port 27027)'
      else
        conflict="two $DB_TYPE setups"
      fi
    elif [[ $DB_TYPE == PS || $DB_TYPE == MYSQL ]]; then
      if [[ -n $mysql_data_owner ]]; then
        conflict="$mysql_data_owner and $DB_TYPE setups (both publish host ports from 3306)"
      fi
      mysql_data_owner=$DB_TYPE
    elif [[ $DB_TYPE == PDPGSQL ]]; then
      setup_type=$(resolve_value PDPGSQL SETUP_TYPE DB_CONFIG)
      if [[ ${setup_type,,} == patroni ]]; then
        patroni_seen=true
        [[ $pgsql_replication_seen == true ]] && host_conflict=$pg_port_conflict
      fi
    elif [[ $DB_TYPE == PGSQL ]]; then
      setup_type=$(resolve_value PGSQL SETUP_TYPE DB_CONFIG)
      if [[ ${setup_type,,} == replication ]]; then
        pgsql_replication_seen=true
        [[ $patroni_seen == true ]] && host_conflict=$pg_port_conflict
      fi
    # EXTERNAL and both Valkey topologies bind host port 6379.
    elif [[ $DB_TYPE == EXTERNAL ]]; then
      external_seen=true
      [[ $valkey_seen == true ]] && host_conflict=$redis_port_conflict
    elif [[ $DB_TYPE == VALKEY ]]; then
      valkey_seen=true
      [[ $external_seen == true ]] && host_conflict=$redis_port_conflict
    fi
    seen_types["$DB_TYPE"]=1
  done

  if [[ -n $host_conflict ]]; then
    die "$host_conflict cannot share a host; provision them on separate machines."
  fi

  if [[ $PARALLEL == true && -n $conflict ]]; then
    log_warn "Running setups sequentially: $conflict cannot run in parallel."
    PARALLEL=false
  fi

  resolve_pmm_server
}

dispatch_setup() {
  local fn=setup_${DB_TYPE,,}
  declare -F "$fn" >/dev/null || die "Database type '$DB_TYPE' has no $fn."
  "$fn"
}

# Re-parses on purpose so DB_* never leak from the previous spec.
run_database_spec() {
  local spec=$1
  parse_database_spec "$spec"
  log_verbose "Setting up $DB_TYPE${DB_VERSION:+ version $DB_VERSION}"
  dispatch_setup
}

# Ends on a newline so the END marker is not glued to the last log line.
cat_setup_log() {
  local log_file=$1
  cat "$log_file"
  if [[ -s $log_file ]] && (($(tail -c 1 "$log_file" | wc -l) == 0)); then
    printf '\n'
  fi
}

# 452 -> 7m32s, 45 -> 45s
format_duration() {
  local seconds=$1
  if ((seconds >= 60)); then
    printf '%dm%02ds' "$((seconds / 60))" "$((seconds % 60))"
  else
    printf '%ds' "$seconds"
  fi
}

# Usage: print_setup_log INDEX TOTAL SPEC STATUS LOG_FILE [ELAPSED_SECONDS]
# A failed setup dumps its log; a successful one only with --verbose.
print_setup_log() {
  local index=$1 total=$2 spec=$3 status=$4 log_file=$5 elapsed=${6:-}
  local took=''

  if [[ -n $elapsed ]]; then
    took=" in $(format_duration "$elapsed")"
  fi

  if ((status == 0)); then
    printf '[%d/%d] %s: OK%s (log: %s)\n' "$index" "$total" "$spec" "$took" "$log_file"
    grep '^agent-status ' "$log_file" 2>/dev/null | sed 's/^agent-status /  /' || true
    if [[ ${VERBOSE:-false} == true ]]; then
      printf '\n===== [%d/%d] %s setup log =====\n' "$index" "$total" "$spec"
      cat_setup_log "$log_file"
      printf '===== END [%d/%d] %s =====\n' "$index" "$total" "$spec"
    fi
    return
  fi

  printf '\n===== [%d/%d] %s FAILED (exit=%d)%s =====\n' \
    "$index" "$total" "$spec" "$status" "$took"
  printf 'log: %s\n' "$log_file"
  cat_setup_log "$log_file"
  printf '===== END [%d/%d] %s =====\n' "$index" "$total" "$spec"
}

# Every setup finishes even after one fails: tearing down half-provisioned
# containers mid-run leaves more mess than it saves. Needs bash 5.1 (wait -p).
run_parallel_setups() {
  local log_dir total index spec status overall_status=0 batch_start attempt
  local -a pids=() logs=() starts=() pending=() failed=()
  batch_start=$(date +%s)
  log_dir=$(mktemp -d "${TMPDIR:-/tmp}/pmm-framework-parallel.XXXXXX")
  total=${#DATABASE_SPECS[@]}

  # Own process group per setup, so a kill reaches the docker commands too.
  set -m

  # shellcheck disable=SC2329,SC2317 # Invoked by the INT/TERM trap.
  cleanup_parallel_jobs() {
    local pid slot
    for pid in "${pids[@]}"; do
      kill -- -"$pid" >/dev/null 2>&1 || kill "$pid" >/dev/null 2>&1 || true
    done
    wait >/dev/null 2>&1 || true
    # Usually CI's timeout on a hung setup; these logs show where it stuck.
    for ((slot = 0; slot < total; slot++)); do
      [[ -n ${pids[slot]} ]] || continue
      printf '\n===== [%d/%d] %s INTERRUPTED =====\n' \
        "$((slot + 1))" "$total" "${DATABASE_SPECS[slot]}"
      printf 'log: %s\n' "${logs[slot]}"
      # A signal between the fork and the child's own redirect leaves this file
      # uncreated; errexit must not abandon the remaining slots over it.
      cat_setup_log "${logs[slot]}" || true
      printf '===== END [%d/%d] %s =====\n' "$((slot + 1))" "$total" "${DATABASE_SPECS[slot]}"
    done
    printf '\nParallel setup logs kept at: %s\n' "$log_dir"
    exit 130
  }
  trap cleanup_parallel_jobs INT TERM

  for ((index = 0; index < total; index++)); do
    pending+=("$index")
  done

  for ((attempt = 0; attempt <= SETUP_RETRIES; attempt++)); do
    ((${#pending[@]} > 0)) || break
    if ((attempt > 0)); then
      printf '\nRetrying %d failed setup(s), attempt %d of %d\n' \
        "${#pending[@]}" "$((attempt + 1))" "$((SETUP_RETRIES + 1))"
    fi

    pids=()
    failed=()
    for index in "${pending[@]}"; do
      spec=${DATABASE_SPECS[index]}
      if ((attempt == 0)); then
        logs[index]=$log_dir/setup-$index.log
      else
        logs[index]=$log_dir/setup-$index-retry$attempt.log
      fi
      starts[index]=$(date +%s)
      printf 'Starting [%d/%d] %s\n' "$((index + 1))" "$total" "$spec"
      # </dev/null: a background process group reading the tty gets SIGTTIN.
      (
        run_database_spec "$spec"
      ) >"${logs[index]}" 2>&1 </dev/null &
      pids[index]=$!
    done

    local -a active_pids=()
    local finished_pid matched
    for index in "${pending[@]}"; do
      active_pids+=("${pids[index]}")
    done
    while ((${#active_pids[@]} > 0)); do
      status=0
      finished_pid=
      wait -n -p finished_pid "${active_pids[@]}" || status=$?
      [[ -n $finished_pid ]] || die "Parallel wait lost track of setup processes."

      matched=false
      for index in "${pending[@]}"; do
        if [[ ${pids[index]} == "$finished_pid" ]]; then
          ((status == 0)) || failed+=("$index")
          print_setup_log \
            "$((index + 1))" "$total" "${DATABASE_SPECS[index]}" \
            "$status" "${logs[index]}" "$(($(date +%s) - starts[index]))"
          pids[index]=
          matched=true
          break
        fi
      done
      [[ $matched == true ]] || die "Parallel wait reaped unknown pid $finished_pid."

      active_pids=()
      for index in "${pending[@]}"; do
        [[ -n ${pids[index]} ]] && active_pids+=("${pids[index]}")
      done
    done

    pending=("${failed[@]}")
  done

  ((${#pending[@]} == 0)) || overall_status=1

  trap - INT TERM
  set +m
  printf 'All %d setups finished in %s\n' "$total" \
    "$(format_duration "$(($(date +%s) - batch_start))")"
  if ((overall_status == 0)); then
    rm -rf "$log_dir"
  else
    printf '\nParallel setup logs kept at: %s\n' "$log_dir"
  fi
  return "$overall_status"
}

# Sequential runs stop at the first failure; parallel ones finish every setup.
run_database_setups() {
  preflight_database_setups
  if [[ $PARALLEL == true ]]; then
    run_parallel_setups
    return
  fi

  local spec start attempt status
  for spec in "${DATABASE_SPECS[@]}"; do
    start=$(date +%s)
    for ((attempt = 0; attempt <= SETUP_RETRIES; attempt++)); do
      ((attempt == 0)) ||
        log_warn "Retrying $spec, attempt $((attempt + 1)) of $((SETUP_RETRIES + 1))."
      # Not `(...) || status=$?`: bash would ignore set -e inside the setup.
      set +e
      (set -e; run_database_spec "$spec")
      status=$?
      set -e
      ((status == 0)) && break
    done
    ((status == 0)) || die "$spec failed after $((SETUP_RETRIES + 1)) attempt(s)."
    printf '%s: OK in %s\n' "$spec" "$(format_duration "$(($(date +%s) - start))")"
  done
}
