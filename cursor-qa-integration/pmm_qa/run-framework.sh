#!/usr/bin/env bash
# Run cursor-qa-integration pmm-framework.py with shared qa-integration modules.
set -euo pipefail

CURSOR_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "${CURSOR_ROOT}/.." && pwd)"
ORIG_PMM_QA="${REPO_ROOT}/qa-integration/pmm_qa"
CURSOR_PMM_QA="${CURSOR_ROOT}/pmm_qa"

export IS_CURSOR_VM=1
export PMM_QA_NO_SYSTEMD=1
export PYTHONPATH="${CURSOR_PMM_QA}:${ORIG_PMM_QA}:${PYTHONPATH:-}"

if [ -f "${ORIG_PMM_QA}/virtenv/bin/activate" ]; then
  # shellcheck source=/dev/null
  source "${ORIG_PMM_QA}/virtenv/bin/activate"
fi

exec python "${CURSOR_PMM_QA}/pmm-framework.py" "$@"
