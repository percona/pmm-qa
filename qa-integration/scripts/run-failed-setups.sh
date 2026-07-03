#!/usr/bin/env bash
# Rerun MicroVM setups that failed in the last batch.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PMM_QA_DIR="${SCRIPT_DIR}/../pmm_qa"
RESULTS_FILE="/tmp/setup-results-rerun-$(date +%Y%m%d-%H%M%S).txt"

# shellcheck source=lib/cursor-vm.sh
source "${SCRIPT_DIR}/lib/cursor-vm.sh"
cursor_vm_apply

export ADMIN_PASSWORD="${ADMIN_PASSWORD:-pmm3admin!}"
export CLIENT_VERSION="${CLIENT_VERSION:-https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/pmm-client/pmm-client-latest.tar.gz}"

cd "${PMM_QA_DIR}"
source virtenv/bin/activate 2>/dev/null || { python3 -m venv virtenv && source virtenv/bin/activate && pip install -q -r requirements.txt; }

cleanup_qa_containers() {
  echo "==> Cleaning QA containers (keeping pmm-server)..."
  docker ps -a --format '{{.Names}}' | grep -v '^pmm-server$' | while read -r name; do
    docker rm -f "$name" 2>/dev/null || true
  done
  docker image prune -f >/dev/null 2>&1 || true
  sudo rm -rf "${HOME}/pgsql_cluster_data" 2>/dev/null || true
}

run_setup() {
  local db="$1"
  local log="/tmp/setup-rerun-$(echo "$db" | tr ',=' '_').log"
  echo ""
  echo "========== TESTING: $db =========="
  cleanup_qa_containers
  if python pmm-framework.py \
    --pmm-server-password "$ADMIN_PASSWORD" \
    --client-version "$CLIENT_VERSION" \
    --database "$db" >"$log" 2>&1; then
    echo "RESULT: $db PASS" | tee -a "$RESULTS_FILE"
    tail -3 "$log"
    return 0
  else
    echo "RESULT: $db FAIL" | tee -a "$RESULTS_FILE"
    rg -n "FAILED!|execution failed|fatal:|ERROR!" "$log" | tail -5 || tail -10 "$log"
    return 1
  fi
}

: >"$RESULTS_FILE"

SETUPS=(
  'pgsql,SETUP_TYPE=replication'
  'pdpgsql'
  'pdpgsql,SETUP_TYPE=replication'
  'pdpgsql,SETUP_TYPE=patroni'
  'pxc'
  'ssl_psmdb'
  'ssl_mlaunch'
  'mlaunch_psmdb'
)

failed=0
for db in "${SETUPS[@]}"; do
  run_setup "$db" || failed=$((failed + 1))
done

echo ""
echo "========== SUMMARY =========="
cat "$RESULTS_FILE"
exit "$failed"
