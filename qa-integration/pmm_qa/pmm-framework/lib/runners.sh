#!/usr/bin/env bash
#
# lib/runners.sh -- the shell-script backend, plus value helpers used by setups.
#
# Two unrelated groups of helpers share this file:
#
#   * run_setup_script() -- the alternative to run_playbook() for the handful of
#     products provisioned by a shell script instead of a playbook (PSMDB,
#     SSL_PSMDB, DOCKERCLIENTS). See setup_uses_ansible() in lib/execution.sh.
#
#   * the small resolvers every setup function calls when filling in its env
#     map: resolved_version, resolved_client_version, admin_password,
#     git_branch, and the PSMDB patch lookup.

# Run a setup shell script with an env map, from a given directory.
#
# Usage: run_setup_script DIRECTORY SCRIPT MAP_NAME
#   DIRECTORY  working directory for the script (scripts use relative paths)
#   SCRIPT     script name inside DIRECTORY, or an absolute path
#   MAP_NAME   *name* of an associative array of KEY=value pairs
#
# The absolute-path form exists for setups that must rewrite a tracked script
# before running it -- setup_ssl_psmdb() generates a patched copy in a temp
# directory but still runs it with the original directory as cwd.
#
# Mirrors run_playbook(): variables go through `env`, never exported.
#
# Reads:  VERBOSE
# Exits:  via die() when the script is missing or exits non-zero
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

# Compare two dotted version strings numerically.
#
# Missing components count as 0, so 8.0 < 8.0.1. Components are forced to base
# 10 (10#) so a zero-padded part such as 08 is not read as octal.
#
# Usage:   version_is_greater 12.1 8.1
# Returns: 0 when LEFT > RIGHT, 1 when LEFT <= RIGHT
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

# Expand a PSMDB major version into its newest full version.
#
# The PSMDB setup scripts want a complete version such as '8.0.26-11', but
# specs name the major series ('8.0'). This lists the psmdb repo the setup
# installs from and picks the highest patch there. Reading the repo rather than
# the percona.com downloads page matters: a release appears on the page (and in
# psmdb-<series>/yum/testing) before its RPMs are promoted to 'release', and the
# Dockerfile installs a pinned '<version>.el<N>' from 'release' -- so the newest
# published patch is not always one that can be installed yet.
#
# 'latest' and '' pass through untouched -- they are meaningful to the setup
# script as-is. This is the only network call the framework makes, and the only
# reason `curl` is required (preflight checks for it only when a PSMDB setup is
# requested).
#
# Reads:  OL_VERSION (the el release the Dockerfile builds on, default 9)
# Usage:  version=$(latest_psmdb_version 8.0)   # -> 8.0.26-11
# Stdout: the resolved version
# Exits:  via die() when the repo index cannot be read or no patch matches
latest_psmdb_version() {
  local requested=$1
  if [[ $requested == latest || -z $requested ]]; then
    printf '%s' "$requested"
    return
  fi

  local el=${OL_VERSION:-9} index latest='' latest_patch='' candidate patch
  index=$(curl --fail --silent --show-error \
    "https://repo.percona.com/psmdb-${requested//./}/yum/release/$el/RPMS/$(uname -m)/") ||
    die "Failed to read the psmdb-${requested//./} release repo index for PSMDB $requested."

  # Patches look like '<major.minor>.<patch>-<build>'; the trailing '-build' is
  # turned into '.build' so version_is_greater can compare it as just another
  # dotted component.
  while IFS= read -r candidate; do
    patch=${candidate#"$requested."}
    patch=${patch//-/.}
    if [[ -z $latest ]] || version_is_greater "$patch" "$latest_patch"; then
      latest=$candidate
      latest_patch=$patch
    fi
  done < <(
    printf '%s' "$index" |
      grep -Eo "percona-server-mongodb-server-${requested//./\\.}\.[0-9]+-[0-9]+\.el$el\." |
      sed -e 's/^percona-server-mongodb-server-//' -e "s/\.el$el\.\$//"
  )
  [[ -n $latest ]] ||
    die "Could not resolve an installable PSMDB patch for '$requested' from the psmdb-${requested//./} release repo."
  printf '%s' "$latest"
}

# The PMM Server admin password for this run.
# Precedence: ADMIN_PASSWORD env > --pmm-server-password > 'admin'.
# Stdout: the password
admin_password() {
  printf '%s' "${ADMIN_PASSWORD:-${PMM_SERVER_PASSWORD:-admin}}"
}

# The pmm-qa branch playbooks should use when fetching helper assets.
# Stdout: PMM_QA_GIT_BRANCH, or 'v3'
git_branch() {
  printf '%s' "${PMM_QA_GIT_BRANCH:-v3}"
}

# Resolve the version for a setup.
#
# Usage: resolved_version PS_VERSION PS "$DB_VERSION"
#   ENV_NAME   product-specific override variable, e.g. PS_VERSION
#   TYPE       registered database type, for the default lookup
#   REQUESTED  version from the spec, or '' when none was given
#
# Precedence: $ENV_NAME > spec version > registered DEFAULT_VERSION.
#
# Note this skips an *empty* $ENV_NAME, mirroring Python's `os.getenv(X) or ...`.
# resolve_value() in lib/config.sh deliberately does the opposite for options --
# see the note there.
#
# Stdout: the resolved version
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

# Resolve CLIENT_VERSION for a setup and expand the latest-tarball alias.
#
# Usage:  client=$(resolved_client_version PS DB_CONFIG)
# Stdout: a PMM Client version or tarball URL
resolved_client_version() {
  local type=$1 config_name=$2
  normalize_client_version "$(resolve_value "$type" CLIENT_VERSION "$config_name")"
}
