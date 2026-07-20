#!/usr/bin/env bash
# Shared docker compose helper for replica-set setup scripts.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../../scripts/lib/cursor-vm.sh
source "${SCRIPT_DIR}/../../scripts/lib/cursor-vm.sh"
cursor_vm_apply

compose_rs() {
  if is_cursor_vm; then
    docker compose -f docker-compose-rs.yaml -f docker-compose-rs.microvm.yaml "$@"
  else
    docker compose -f docker-compose-rs.yaml "$@"
  fi
}

compose_sharded() {
  if is_cursor_vm; then
    docker compose -f docker-compose-sharded.yaml -f docker-compose-sharded.microvm.yaml "$@"
  else
    docker compose -f docker-compose-sharded.yaml "$@"
  fi
}
