#!/usr/bin/env bash

ANSIBLE_COLLECTION_CHECKED=false

configure_ansible_python() {
  [[ -n ${ANSIBLE_PYTHON_INTERPRETER:-} ]] && return

  local candidate=${PMM_FRAMEWORK_ANSIBLE_PYTHON_FALLBACK:-$PMM_QA_ROOT/pmm_framework/bin/python}
  if [[ -x $candidate ]] && "$candidate" -c 'import requests' >/dev/null 2>&1; then
    export ANSIBLE_PYTHON_INTERPRETER=$candidate
    log_verbose "Using Ansible module interpreter: $ANSIBLE_PYTHON_INTERPRETER"
  fi
}

ensure_docker_collection() {
  [[ $ANSIBLE_COLLECTION_CHECKED == true ]] && return
  if ! ansible-galaxy collection list community.docker >/dev/null 2>&1; then
    log_info "Installing Ansible collection community.docker..."
    ansible-galaxy collection install community.docker ||
      die "Failed to install Ansible collection community.docker."
  fi
  ANSIBLE_COLLECTION_CHECKED=true
}

print_env_map() {
  local map_name=$1
  local -n map_ref=$map_name
  local key
  for key in "${!map_ref[@]}"; do
    printf '  %s=%q\n' "$key" "${map_ref[$key]}"
  done | sort
}

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
