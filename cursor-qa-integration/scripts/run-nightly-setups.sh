#!/usr/bin/env bash
# Run nightly-gha database setups on MicroVM (same --database flags as nightly-e2e-tests-matrix.yml).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CURSOR_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RESULTS_FILE="/tmp/nightly-setup-results-$(date +%Y%m%d).txt"

# shellcheck source=lib/cursor-vm.sh
source "${SCRIPT_DIR}/lib/cursor-vm.sh"
export IS_CURSOR_VM="${IS_CURSOR_VM:-1}"
cursor_vm_apply

export ADMIN_PASSWORD="${ADMIN_PASSWORD:-pmm3admin!}"
export CLIENT_VERSION="${CLIENT_VERSION:-https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/pmm-client/pmm-client-latest.tar.gz}"

RUN_FRAMEWORK="${CURSOR_ROOT}/pmm_qa/run-framework.sh"

cleanup_qa_containers() {
  echo "==> Cleaning QA containers (keeping pmm-server)..."
  docker ps -a --format '{{.Names}}' | grep -v '^pmm-server$' | while read -r name; do
    docker rm -f "$name" 2>/dev/null || true
  done
  docker image prune -f >/dev/null 2>&1 || true
}

run_setup() {
  local db="$1"
  local log="/tmp/setup-$(echo "$db" | tr ',=' '_').log"
  echo ""
  echo "========== TESTING: $db =========="
  cleanup_qa_containers
  if "$RUN_FRAMEWORK" \
    --pmm-server-password "$ADMIN_PASSWORD" \
    --client-version "$CLIENT_VERSION" \
    --database "$db" >"$log" 2>&1; then
    echo "RESULT: $db PASS" | tee -a "$RESULTS_FILE"
    tail -3 "$log"
    return 0
  else
    echo "RESULT: $db FAIL" | tee -a "$RESULTS_FILE"
    rg -n "FAILED!|execution failed|fatal:" "$log" | tail -5 || tail -10 "$log"
    return 1
  fi
}

: >"$RESULTS_FILE"

# Mirrors .github/workflows/nightly-e2e-tests-matrix.yml setup matrix (13 unique shards; nightly runs pxc twice).
SETUPS=(
  'external'
  'haproxy'
  'ps,SETUP_TYPE=gr'
  'mysql'
  'ps,SETUP_TYPE=replication'
  'pxc'
  'ps,QUERY_SOURCE=slowlog,MY_ROCKS=true'
  'psmdb,SETUP_TYPE=pss'
  'pdpgsql'
  'pgsql'
  'pdpgsql,SETUP_TYPE=patroni'
  'psmdb,SETUP_TYPE=sharding'
  'valkey'
)

failed=0
for db in "${SETUPS[@]}"; do
  run_setup "$db" || failed=$((failed + 1))
done

echo ""
echo "========== SUMMARY =========="
cat "$RESULTS_FILE"
exit "$failed"
