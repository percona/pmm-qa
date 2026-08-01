#!/usr/bin/env bash
# Shared docker compose helper for PSMDB setups (MicroVM overlay when IS_CURSOR_VM=1).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PSMDB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

is_cursor_vm() {
  case "${IS_CURSOR_VM:-}${PMM_QA_NO_SYSTEMD:-}" in
    1|true|yes|TRUE|YES|True) return 0 ;;
    *) return 1 ;;
  esac
}

compose_rs() {
  if is_cursor_vm; then
    docker compose -f "$PSMDB_ROOT/docker-compose-rs.yaml" -f "$PSMDB_ROOT/docker-compose-rs.microvm.yaml" "$@"
  else
    docker compose -f "$PSMDB_ROOT/docker-compose-rs.yaml" "$@"
  fi
}

compose_sharded() {
  if is_cursor_vm; then
    docker compose -f "$PSMDB_ROOT/docker-compose-sharded.yaml" -f "$PSMDB_ROOT/docker-compose-sharded.microvm.yaml" "$@"
  else
    docker compose -f "$PSMDB_ROOT/docker-compose-sharded.yaml" "$@"
  fi
}
