#!/usr/bin/env bash
#
# lib/common.sh -- logging, fatal errors and small value helpers.
#
# The lowest layer of the framework: it depends on nothing else and is sourced
# first, so every other module may call these helpers. Keep it free of Docker,
# Ansible and database knowledge.
#
# Convention used throughout the framework: helpers that produce a *value*
# print it to stdout with no trailing newline, so callers can capture it with
# `value=$(helper ...)`. Helpers that report a *fact* return 0 or 1 instead.

# Print a line to stdout. Always shown, regardless of --verbose.
# Usage: log_info "PS setup finished"
log_info() {
  printf '%s\n' "$*"
}

# Print a line to stdout only when --verbose was passed.
# Use for detail that helps when debugging a setup but is noise otherwise.
# Reads: VERBOSE
# Usage: log_verbose "Using interpreter: $path"
log_verbose() {
  if [[ ${VERBOSE:-false} == true ]]; then
    printf '%s\n' "$*"
  fi
}

# Print a WARNING line to stderr and carry on.
# Use when the run can still succeed but the user should know something was
# assumed or degraded (for example falling back to sequential setups).
# Usage: log_warn "Found 2 PMM Server containers; using the first"
log_warn() {
  printf 'WARNING: %s\n' "$*" >&2
}

# Print an ERROR line to stderr and terminate.
#
# Note this exits the *current shell*: at top level it aborts the whole run,
# but inside `$(...)` or a background parallel setup it only ends that
# subshell. The framework relies on `set -e` (plus `inherit_errexit`) to
# propagate that failure outward -- see the entrypoint.
# Usage: die "Database type '$name' is not recognized."
die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

# Abort unless an executable is on PATH.
# Usage: require_command docker
require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command '$1' was not found in PATH."
}

# Normalize a loosely-typed truthy value to exactly 'true' or 'false'.
#
# Ansible playbooks read these as `| bool`, which accepts both spellings, but
# emitting one canonical form keeps --verbose output and tests predictable.
# Anything unrecognized (including empty) becomes 'false'.
# Stdout: 'true' or 'false'
# Usage: env_map[CLIENT_DEBUG]="$(bool_string "$CLIENT_DEBUG")"
bool_string() {
  case "${1:-false}" in
    true|TRUE|True|1|yes|YES|Yes) printf 'true' ;;
    *) printf 'false' ;;
  esac
}

# Expand the 'latest-tarball' alias into the PMM Client build-cache URL.
#
# Any other value -- a version like '3-dev-latest', or an explicit URL -- is
# passed through untouched, so callers can always pipe CLIENT_VERSION through
# this before handing it to a playbook.
# Stdout: the resolved client version or URL
# Usage: client=$(normalize_client_version "$raw")
normalize_client_version() {
  if [[ ${1:-} == latest-tarball ]]; then
    printf '%s' 'https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/pmm-client/pmm-client-latest.tar.gz'
  else
    printf '%s' "${1:-}"
  fi
}
