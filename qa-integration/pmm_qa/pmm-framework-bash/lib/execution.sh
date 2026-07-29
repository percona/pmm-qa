#!/usr/bin/env bash

setup_uses_ansible() {
  case "$1" in
    PSMDB|SSL_PSMDB|DOCKERCLIENTS) return 1 ;;
    *) return 0 ;;
  esac
}

preflight_database_setups() {
  local spec needs_server=false needs_curl=false needs_ansible=false mysql_data_owner=''
  declare -A seen_types=()

  for spec in "${DATABASE_SPECS[@]}"; do
    parse_database_spec "$spec"
    setup_requires_server "$DB_TYPE" && needs_server=true
    [[ $DB_TYPE == PSMDB || $DB_TYPE == SSL_PSMDB ]] && needs_curl=true
    setup_uses_ansible "$DB_TYPE" && needs_ansible=true

    if [[ $PARALLEL == true && -v "seen_types[$DB_TYPE]" ]]; then
      log_warn "Parallel $DB_TYPE setups may collide on containers, ports, or data directories."
    fi
    if [[ $PARALLEL == true && ($DB_TYPE == PS || $DB_TYPE == MYSQL) ]]; then
      if [[ -n $mysql_data_owner ]]; then
        die "Parallel $mysql_data_owner and $DB_TYPE setups share mysql_cluster_data and host ports."
      fi
      mysql_data_owner=$DB_TYPE
    fi
    seen_types["$DB_TYPE"]=1
  done

  [[ $needs_server == true ]] && resolve_pmm_server
  [[ $needs_curl == true ]] && require_command curl
  if [[ $PARALLEL == true && $needs_ansible == true ]]; then
    configure_ansible_python
    ensure_docker_collection
  fi
}

run_database_spec() {
  local spec=$1
  parse_database_spec "$spec"

  if [[ $VERBOSE == true ]]; then
    if [[ -n $DB_VERSION ]]; then
      log_info "Setting up $DB_TYPE version $DB_VERSION"
    else
      log_info "Setting up $DB_TYPE"
    fi
  fi
  dispatch_setup
}

print_setup_log() {
  local index=$1 total=$2 spec=$3 status=$4 log_file=$5

  # Successful setups stay quiet: keep the full log on disk and print only a
  # one-line summary. Failures dump the buffered log so diagnosis stays in the
  # console without interleaving other parallel jobs.
  if ((status == 0)); then
    printf '[%d/%d] %s: OK (log: %s)\n' "$index" "$total" "$spec" "$log_file"
    return
  fi

  printf '\n===== [%d/%d] %s FAILED (exit=%d) =====\n' \
    "$index" "$total" "$spec" "$status"
  printf 'log: %s\n' "$log_file"
  cat "$log_file"
  # Keep the END marker on its own line when the log has no trailing newline.
  if [[ -s $log_file ]] && (($(tail -c 1 "$log_file" | wc -l) == 0)); then
    printf '\n'
  fi
  printf '===== END [%d/%d] %s =====\n' "$index" "$total" "$spec"
}

run_parallel_setups() {
  local log_dir total index spec status overall_status=0
  local -a pids=() logs=()
  log_dir=$(mktemp -d "${TMPDIR:-/tmp}/pmm-framework-parallel.XXXXXX")
  total=${#DATABASE_SPECS[@]}

  # Job control puts each background setup in its own process group, so an
  # interrupt can take down ansible-playbook and its children too. Without it
  # `kill $pid` would only reap the wrapper subshell and leave the real
  # provisioning work running.
  set -m

  # shellcheck disable=SC2329 # Invoked by the INT/TERM trap.
  cleanup_parallel_jobs() {
    local pid
    for pid in "${pids[@]}"; do
      # Negative PID targets the whole process group; fall back to the single
      # process if the group is already gone.
      kill -- -"$pid" >/dev/null 2>&1 || kill "$pid" >/dev/null 2>&1 || true
    done
    wait >/dev/null 2>&1 || true
    rm -rf "$log_dir"
    exit 130
  }
  trap cleanup_parallel_jobs INT TERM

  for ((index = 0; index < total; index++)); do
    spec=${DATABASE_SPECS[index]}
    logs[index]=$log_dir/setup-$index.log
    printf 'Starting [%d/%d] %s\n' "$((index + 1))" "$total" "$spec"
    # stdin must come from /dev/null: job control puts each setup in a
    # background process group, where reading the terminal raises SIGTTIN and
    # stops the job forever. Parallel setups have no usable stdin anyway.
    (
      run_database_spec "$spec"
    ) >"${logs[index]}" 2>&1 </dev/null &
    pids[index]=$!
  done

  # Report each setup as soon as it finishes. Waiting in argument order made
  # completed jobs look stuck behind a slower neighbor (and hid progress when
  # Docker or a playbook hung).
  local -a active_pids=("${pids[@]}")
  local finished_pid matched
  while ((${#active_pids[@]} > 0)); do
    status=0
    finished_pid=
    wait -n -p finished_pid "${active_pids[@]}" || status=$?
    [[ -n $finished_pid ]] || die "Parallel wait lost track of setup processes."

    matched=false
    for ((index = 0; index < total; index++)); do
      if [[ ${pids[index]} == "$finished_pid" ]]; then
        ((status == 0)) || overall_status=1
        print_setup_log \
          "$((index + 1))" "$total" "${DATABASE_SPECS[index]}" \
          "$status" "${logs[index]}"
        pids[index]=
        matched=true
        break
      fi
    done
    [[ $matched == true ]] || die "Parallel wait reaped unknown pid $finished_pid."

    active_pids=()
    for ((index = 0; index < total; index++)); do
      [[ -n ${pids[index]} ]] && active_pids+=("${pids[index]}")
    done
  done

  trap - INT TERM
  set +m
  if ((overall_status == 0)); then
    rm -rf "$log_dir"
  else
    printf '\nParallel setup logs kept at: %s\n' "$log_dir"
  fi
  return "$overall_status"
}

run_database_setups() {
  preflight_database_setups
  if [[ $PARALLEL == true ]]; then
    run_parallel_setups
    return
  fi

  local spec
  for spec in "${DATABASE_SPECS[@]}"; do
    run_database_spec "$spec"
  done
}
