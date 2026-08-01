#!/usr/bin/env bash
# Run qa-integration bash pmm-framework on Cursor MicroVM (IS_CURSOR_VM=1).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# shellcheck source=lib/cursor-vm.sh
source "${SCRIPT_DIR}/lib/cursor-vm.sh"
export IS_CURSOR_VM="${IS_CURSOR_VM:-1}"
cursor_vm_apply

exec "${REPO_ROOT}/qa-integration/pmm_qa/pmm-framework/pmm-framework" "$@"
