#!/usr/bin/env bash

log_info() {
  printf '%s\n' "$*"
}

log_verbose() {
  if [[ ${VERBOSE:-false} == true ]]; then
    printf '%s\n' "$*"
  fi
}

log_warn() {
  printf 'WARNING: %s\n' "$*" >&2
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command '$1' was not found in PATH."
}

bool_string() {
  case "${1:-false}" in
    true|TRUE|True|1|yes|YES|Yes) printf 'true' ;;
    *) printf 'false' ;;
  esac
}

normalize_client_version() {
  if [[ ${1:-} == latest-tarball ]]; then
    printf '%s' 'https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/pmm-client/pmm-client-latest.tar.gz'
  else
    printf '%s' "${1:-}"
  fi
}
