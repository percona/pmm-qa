#!/usr/bin/env bash
#
# lib/execution.sh -- orchestration: preflight checks, then run the setups.
#
# This is the top of the call graph. run_database_setups() is the only function
# the entrypoint calls, and everything below is either preflight or one of the
# two execution strategies:
#
#   sequential  each spec in argument order, output streaming straight to the
#               console. The default, and where a failure stops the run.
#   parallel    every spec at once, each with its output buffered to its own
#               log file so concurrent runs cannot interleave. All setups are
#               allowed to finish and the run fails if any of them did.
#
# Preflight may downgrade parallel to sequential -- see the conflict rules in
# preflight_database_setups().

# Does this database type provision through Ansible rather than a shell script?
#
# Used only to decide whether preflight needs to warm up the Ansible bits
# before parallel setups start. The actual choice of backend lives in each
# setup function, which calls run_playbook() or run_setup_script() directly.
#
# Returns: 0 for playbook-backed types, 1 for script-backed ones
setup_uses_ansible() {
  case "$1" in
    PSMDB|SSL_PSMDB|DOCKERCLIENTS) return 1 ;;
    *) return 0 ;;
  esac
}

# Validate the whole run before provisioning anything.
#
# Walks every spec once to answer three questions, so that a bad request fails
# in seconds rather than halfway through a ten-minute provisioning run:
#
#   * does anything need a PMM Server address, curl, or Ansible?
#   * do any two setups conflict, so parallel is unsafe?
#   * are the shared Ansible prerequisites ready before jobs fork?
#
# Conflict rule: two setups of the same type, or any two of the MySQL family
# (PS/MYSQL), reuse the same container names, host ports and data directories.
# Rather than refusing the run, the framework keeps every setup and gives up
# only the concurrency -- the caller asked for something valid that merely
# cannot happen at the same time.
#
# Reads:  DATABASE_SPECS, PARALLEL
# Writes: PARALLEL (may be turned off), PMM_SERVER_HOST/PORT via resolve_pmm_server
# Exits:  via die() from the helpers it calls (unknown type, missing server, ...)
preflight_database_setups() {
  local spec needs_server=false needs_curl=false needs_ansible=false
  local mysql_data_owner='' conflict=''
  declare -A seen_types=()

  for spec in "${DATABASE_SPECS[@]}"; do
    parse_database_spec "$spec"
    setup_requires_server "$DB_TYPE" && needs_server=true
    [[ $DB_TYPE == PSMDB || $DB_TYPE == SSL_PSMDB ]] && needs_curl=true
    setup_uses_ansible "$DB_TYPE" && needs_ansible=true

    # Two setups of the same product, or any two of the MySQL family, reuse the
    # same container names, host ports and data directories, so they cannot run
    # at the same time.
    if [[ -v "seen_types[$DB_TYPE]" ]]; then
      conflict="two $DB_TYPE setups"
    elif [[ $DB_TYPE == PS || $DB_TYPE == MYSQL ]]; then
      if [[ -n $mysql_data_owner ]]; then
        conflict="$mysql_data_owner and $DB_TYPE setups (shared mysql_cluster_data and host ports)"
      fi
      mysql_data_owner=$DB_TYPE
    fi
    seen_types["$DB_TYPE"]=1
  done

  # Fall back to sequential rather than refusing to run: the caller asked for a
  # valid set of setups, they just cannot be provisioned concurrently.
  if [[ $PARALLEL == true && -n $conflict ]]; then
    log_warn "Running setups sequentially: $conflict cannot run in parallel."
    PARALLEL=false
  fi

  [[ $needs_server == true ]] && resolve_pmm_server
  [[ $needs_curl == true ]] && require_command curl
  # Warm these up before forking so parallel jobs cannot race to install the
  # same Ansible collection.
  if [[ $PARALLEL == true && $needs_ansible == true ]]; then
    configure_ansible_python
    ensure_docker_collection
  fi
}

# Expand one spec and provision it.
#
# The single unit of work, shared by both strategies: sequential calls it in a
# loop, parallel calls it once per background job. Re-parsing here (preflight
# already parsed every spec) is deliberate -- it guarantees DB_TYPE, DB_VERSION
# and DB_CONFIG describe *this* spec and nothing has leaked from the previous
# one.
#
# Reads:  VERBOSE
# Writes: DB_TYPE, DB_VERSION, DB_CONFIG via parse_database_spec
# Exits:  via die() when the setup fails
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

# Should a *successful* setup echo its buffered log to the console?
#
# No by default: a green run prints one summary line per setup and keeps the
# full transcript on disk, so CI logs stay readable. `--verbose` opts in and
# echoes them too, for when you want to see what a passing setup actually did.
#
# A setup that FAILED always dumps its log regardless -- that is not optional.
#
# Reads:   VERBOSE
# Returns: 0 to echo successful logs, 1 to keep them on disk only
should_dump_successful_logs() {
  [[ ${VERBOSE:-false} == true ]]
}

# Report one finished parallel setup.
#
# Usage: print_setup_log INDEX TOTAL SPEC STATUS LOG_FILE
#
# A failed setup always dumps its buffered log; a successful one prints just a
# summary line unless --verbose asked for more. Only ever used by the parallel
# path -- sequential setups write straight to the console and need no
# buffering. Because a log is emitted in one go, concurrent setups never
# interleave mid-line.
#
# Stdout: a summary line, plus the buffered log when the setup failed or when
#         --verbose was given
print_setup_log() {
  local index=$1 total=$2 spec=$3 status=$4 log_file=$5

  if ((status == 0)); then
    printf '[%d/%d] %s: OK (log: %s)\n' "$index" "$total" "$spec" "$log_file"
    if should_dump_successful_logs; then
      printf '\n===== [%d/%d] %s setup log =====\n' "$index" "$total" "$spec"
      cat "$log_file"
      if [[ -s $log_file ]] && (($(tail -c 1 "$log_file" | wc -l) == 0)); then
        printf '\n'
      fi
      printf '===== END [%d/%d] %s =====\n' "$index" "$total" "$spec"
    fi
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

# Provision every spec concurrently, reporting each as it finishes.
#
# Each setup runs in its own background subshell with stdout and stderr
# redirected to a per-setup log file, so output never interleaves. Results are
# printed in completion order, not argument order, so a fast setup is visible
# immediately instead of appearing stuck behind a slow neighbour.
#
# Every setup is allowed to finish even after one fails, because tearing down
# half-provisioned containers mid-run leaves more mess than it saves.
#
# On success the log directory is removed; on failure it is kept and its path
# printed, so the full transcripts survive for inspection.
#
# Requires: bash 5.1+ for `wait -n -p`
# Reads:    DATABASE_SPECS
# Returns:  0 when every setup succeeded, 1 when any failed
# Exits:    130 from the INT/TERM trap
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

    # Map the reaped pid back to its slot so the report names the right spec.
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

    # Rebuild the still-running set; cleared slots drop out.
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

# Entry point for provisioning: preflight, then run every requested setup.
#
# The only function the entrypoint calls. Preflight decides which strategy is
# safe, so the PARALLEL check below happens *after* any downgrade.
#
# Unlike the parallel path, a sequential run stops at the first failure: die()
# in a setup aborts the whole script.
#
# Reads:  DATABASE_SPECS, PARALLEL
# Returns: 0 when every setup succeeded, non-zero otherwise
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
