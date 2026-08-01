#!/usr/bin/env bash
# Run bash pmm-framework on MicroVM (upstream qa-integration + cursor overlays).
set -euo pipefail

CURSOR_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# shellcheck source=../scripts/lib/cursor-vm.sh
source "${CURSOR_ROOT}/scripts/lib/cursor-vm.sh"
export IS_CURSOR_VM="${IS_CURSOR_VM:-1}"
cursor_vm_apply

exec "${CURSOR_ROOT}/pmm-framework/pmm-framework" "$@"
