#!/usr/bin/env bash
# Cursor MicroVM detection — set IS_CURSOR_VM=1 in Cursor automation secrets.
# Internal flags (PMM_QA_NO_SYSTEMD, etc.) are derived automatically.

cursor_vm_truthy() {
  case "${1:-}" in
    1|true|yes|TRUE|YES|True) return 0 ;;
    *) return 1 ;;
  esac
}

is_cursor_vm() {
  cursor_vm_truthy "${IS_CURSOR_VM:-}" || cursor_vm_truthy "${PMM_QA_NO_SYSTEMD:-}"
}

# Export derived env for child processes (bash, docker compose, ansible).
cursor_vm_apply() {
  if is_cursor_vm; then
    export IS_CURSOR_VM=1
    export PMM_QA_NO_SYSTEMD=1
  fi
}
