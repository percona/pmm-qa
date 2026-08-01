#!/usr/bin/env bash
# Run qa-integration bash pmm-framework on Cursor MicroVM (IS_CURSOR_VM=1).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PMM_QA="${REPO_ROOT}/qa-integration/pmm_qa"

# shellcheck source=lib/cursor-vm.sh
source "${SCRIPT_DIR}/lib/cursor-vm.sh"
export IS_CURSOR_VM="${IS_CURSOR_VM:-1}"
cursor_vm_apply

# valkey playbook uses community.docker; needs docker>=7 Python SDK + recent collection.
microvm_bootstrap_ansible() {
  if ! python3 -c 'import docker' >/dev/null 2>&1; then
    pip3 install --user -q 'docker>=7.0.0' 2>/dev/null || true
  fi
  if ! ansible-galaxy collection list community.docker 2>/dev/null | awk '/community\.docker/{print $2}' | grep -qE '^[5-9]'; then
    ansible-galaxy collection install -p "${HOME}/.ansible/collections" community.docker >/dev/null 2>&1 || true
  fi
  export ANSIBLE_COLLECTIONS_PATH="${HOME}/.ansible/collections:${ANSIBLE_COLLECTIONS_PATH:-/usr/lib/python3/dist-packages/ansible_collections}"
  export ANSIBLE_PYTHON_INTERPRETER="${ANSIBLE_PYTHON_INTERPRETER:-$(command -v python3)}"
}

if is_cursor_vm; then
  microvm_bootstrap_ansible
  if [[ -x ${PMM_QA}/virtenv/bin/python ]]; then
    export PMM_FRAMEWORK_ANSIBLE_PYTHON_FALLBACK="${PMM_QA}/virtenv/bin/python"
  elif [[ -x ${PMM_QA}/pmm_framework/bin/python ]]; then
    export PMM_FRAMEWORK_ANSIBLE_PYTHON_FALLBACK="${PMM_QA}/pmm_framework/bin/python"
  fi
fi

exec "${PMM_QA}/pmm-framework/pmm-framework" "$@"
