#!/usr/bin/env bash
#
# lib/ansible.sh -- running the existing Ansible playbooks.
#
# The framework owns no provisioning logic of its own. Each setup function
# builds an associative array of environment variables and hands it here; the
# playbooks under qa-integration/pmm_qa/ read those with `lookup('env', ...)`
# and do the actual work.
#
# That env map is the contract between a setup function and its playbook. If a
# playbook reads a variable the setup never sets, the playbook's own
# `| default(...)` decides -- there is no error, so a typo in a key name fails
# silently. Check both sides when adding one.

# Guard so the collection check runs at most once per process.
ANSIBLE_COLLECTION_CHECKED=false

# Point Ansible modules at a Python that has `requests`, if one is available.
#
# community.docker modules need `requests`; the interpreter Ansible discovers by
# default may not have it. Prefers an explicit ANSIBLE_PYTHON_INTERPRETER, then
# the repo's pmm_framework virtualenv. Silently does nothing when neither is
# usable, leaving Ansible's own discovery in charge.
#
# Reads:  ANSIBLE_PYTHON_INTERPRETER, PMM_FRAMEWORK_ANSIBLE_PYTHON_FALLBACK,
#         PMM_QA_ROOT
# Writes: exports ANSIBLE_PYTHON_INTERPRETER when a suitable interpreter is found
configure_ansible_python() {
  [[ -n ${ANSIBLE_PYTHON_INTERPRETER:-} ]] && return

  local candidate=${PMM_FRAMEWORK_ANSIBLE_PYTHON_FALLBACK:-$PMM_QA_ROOT/pmm_framework/bin/python}
  if [[ -x $candidate ]] && "$candidate" -c 'import requests' >/dev/null 2>&1; then
    export ANSIBLE_PYTHON_INTERPRETER=$candidate
    log_verbose "Using Ansible module interpreter: $ANSIBLE_PYTHON_INTERPRETER"
  fi
}

# Install the community.docker collection unless it is already present.
#
# Checked once per process, and pre-warmed by preflight before parallel setups
# so several concurrent jobs cannot race to install the same collection.
#
# Writes: ANSIBLE_COLLECTION_CHECKED
# Exits:  via die() when the install fails
ensure_docker_collection() {
  [[ $ANSIBLE_COLLECTION_CHECKED == true ]] && return
  if ! ansible-galaxy collection list community.docker >/dev/null 2>&1; then
    log_info "Installing Ansible collection community.docker..."
    ansible-galaxy collection install community.docker ||
      die "Failed to install Ansible collection community.docker."
  fi
  ANSIBLE_COLLECTION_CHECKED=true
}

# Print an env map as sorted `  KEY=value` lines, shell-quoted.
#
# Takes the array *by name* because bash cannot pass an associative array by
# value. Used by --verbose to show exactly what a playbook will receive.
#
# Usage:  print_env_map env_map
# Stdout: one sorted `  KEY=value` line per entry
print_env_map() {
  local map_name=$1
  local -n map_ref=$map_name
  local key
  for key in "${!map_ref[@]}"; do
    printf '  %s=%q\n' "$key" "${map_ref[$key]}"
  done | sort
}

# Run a playbook with an env map, from the qa-integration/pmm_qa directory.
#
# Usage: run_playbook 'valkey/valkey-cluster.yml' env_map
#   PLAYBOOK  path relative to PMM_QA_ROOT
#   MAP_NAME  *name* of an associative array of KEY=value pairs
#
# Variables are passed with `env KEY=value ...` rather than exported, so nothing
# leaks between setups: each playbook sees exactly the map it was given. `env`
# execs ansible-playbook, so the values do not linger in the process command
# line either.
#
# VERBOSITY_LEVEL becomes that many -v flags (default 1).
#
# Reads:  PMM_QA_ROOT, VERBOSE, VERBOSITY_LEVEL
# Exits:  via die() when the playbook fails
run_playbook() {
  local playbook=$1 map_name=$2
  local -n env_ref=$map_name
  configure_ansible_python
  ensure_docker_collection

  local -a env_args=()
  local key
  for key in "${!env_ref[@]}"; do
    env_args+=("$key=${env_ref[$key]}")
  done

  local -a verbosity_args=()
  local index
  for ((index = 0; index < VERBOSITY_LEVEL; index++)); do
    verbosity_args+=(-v)
  done

  log_verbose "Running playbook $playbook with:"
  [[ $VERBOSE == true ]] && print_env_map "$map_name"

  (
    cd "$PMM_QA_ROOT"
    env "${env_args[@]}" ansible-playbook \
      -i 'localhost,' \
      --connection=local \
      "${verbosity_args[@]}" \
      "$playbook"
  ) || die "$playbook playbook execution failed."
  log_info "$playbook playbook execution successful"
}
