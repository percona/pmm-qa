#!/usr/bin/env bash
#
# lib/common.sh -- logging, fatal errors and small value helpers. Sourced
# first; keep it free of Docker and database knowledge.
# Value helpers print without a trailing newline, for `x=$(helper ...)`.

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

# Inside $(...) or a parallel setup this only ends that subshell; set -e and
# inherit_errexit carry the failure out.
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

# 'latest-tarball' -> the build-cache URL for this host's arch; anything else
# passes through.
normalize_client_version() {
  if [[ ${1:-} == latest-tarball ]]; then
    local bucket=pmm-client
    case "$(uname -m)" in
      aarch64 | arm64) bucket=pmm-client-arm ;;
    esac
    printf '%s' "https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/${bucket}/pmm-client-latest.tar.gz"
  else
    printf '%s' "${1:-}"
  fi
}
