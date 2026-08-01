#!/usr/bin/env bash
# Shared docker compose helper for PSMDB setups on MicroVM.
# Base compose files live in qa-integration/; MicroVM overrides stay here.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CURSOR_PSMDB="${PMM_QA_PSMDB_MICROVM_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

if [[ -n ${PMM_QA_PSMDB_ROOT:-} ]]; then
  QA_PSMDB="$PMM_QA_PSMDB_ROOT"
elif [[ -n ${QA_INTEGRATION_ROOT:-} ]]; then
  QA_PSMDB="$QA_INTEGRATION_ROOT/pmm_psmdb-pbm_setup"
else
  QA_PSMDB="$(cd "$CURSOR_PSMDB/../../qa-integration/pmm_psmdb-pbm_setup" && pwd)"
fi

# shellcheck source=../../scripts/lib/cursor-vm.sh
source "${SCRIPT_DIR}/../../scripts/lib/cursor-vm.sh"
cursor_vm_apply

compose_rs() {
  if is_cursor_vm; then
    docker compose \
      -f "$QA_PSMDB/docker-compose-rs.yaml" \
      -f "$CURSOR_PSMDB/docker-compose-rs.microvm.yaml" "$@"
  else
    docker compose -f "$QA_PSMDB/docker-compose-rs.yaml" "$@"
  fi
}

compose_sharded() {
  if is_cursor_vm; then
    docker compose \
      -f "$QA_PSMDB/docker-compose-sharded.yaml" \
      -f "$CURSOR_PSMDB/docker-compose-sharded.microvm.yaml" "$@"
  else
    docker compose -f "$QA_PSMDB/docker-compose-sharded.yaml" "$@"
  fi
}
