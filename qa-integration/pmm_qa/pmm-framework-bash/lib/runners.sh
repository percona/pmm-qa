#!/usr/bin/env bash

run_setup_script() {
  local directory=$1 script=$2 map_name=$3
  local -n env_ref=$map_name
  local -a env_args=()
  local key
  for key in "${!env_ref[@]}"; do
    env_args+=("$key=${env_ref[$key]}")
  done

  local script_path=$directory/$script
  if [[ $script == /* ]]; then
    script_path=$script
  fi
  [[ -f $script_path ]] ||
    die "Setup script '$script_path' does not exist."
  log_verbose "Running setup script $directory/$script with:"
  [[ $VERBOSE == true ]] && print_env_map "$map_name"

  (
    cd "$directory"
    env "${env_args[@]}" bash "$script_path"
  ) || die "Setup script '$script' failed."
}

version_is_greater() {
  local left=$1 right=$2 index left_part right_part
  local -a left_parts=() right_parts=()
  IFS='.' read -r -a left_parts <<<"$left"
  IFS='.' read -r -a right_parts <<<"$right"
  local length=${#left_parts[@]}
  ((${#right_parts[@]} > length)) && length=${#right_parts[@]}
  for ((index = 0; index < length; index++)); do
    left_part=${left_parts[index]:-0}
    right_part=${right_parts[index]:-0}
    ((10#$left_part > 10#$right_part)) && return 0
    ((10#$left_part < 10#$right_part)) && return 1
  done
  return 1
}

latest_psmdb_version() {
  local requested=$1
  if [[ $requested == latest || -z $requested ]]; then
    printf '%s' "$requested"
    return
  fi

  local response latest='' latest_patch='' candidate patch
  response=$(curl --fail --silent --show-error \
    --data-urlencode "version=percona-server-mongodb-$requested" \
    'https://www.percona.com/products-api.php') ||
    die "Failed to query the Percona products API for PSMDB $requested."

  while IFS= read -r candidate; do
    patch=${candidate#"$requested-"}
    if [[ -z $latest ]] || version_is_greater "$patch" "$latest_patch"; then
      latest=$candidate
      latest_patch=$patch
    fi
  done < <(
    printf '%s' "$response" |
      grep -Eo 'value="[^"]+"' |
      cut -d'"' -f2 |
      cut -d'|' -f1 |
      sed 's/^percona-server-mongodb-//' |
      grep -E "^${requested//./\\.}-[0-9]+([.][0-9]+)*$"
  )
  [[ -n $latest ]] ||
    die "Could not resolve the latest PSMDB patch for '$requested'."
  printf '%s' "$latest"
}

admin_password() {
  printf '%s' "${ADMIN_PASSWORD:-${PMM_SERVER_PASSWORD:-admin}}"
}

git_branch() {
  printf '%s' "${PMM_QA_GIT_BRANCH:-v3}"
}

resolved_version() {
  local env_name=$1 type=$2 requested=$3
  if [[ -n ${!env_name:-} ]]; then
    printf '%s' "${!env_name}"
  elif [[ -n $requested ]]; then
    printf '%s' "$requested"
  else
    database_default_version "$type"
  fi
}

resolved_client_version() {
  local type=$1 config_name=$2
  normalize_client_version "$(resolve_value "$type" CLIENT_VERSION "$config_name")"
}
