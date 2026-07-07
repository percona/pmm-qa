#!/usr/bin/env bash
# Canonical: .cursor/scripts/run-migration-single-test.sh
# Provision minimal PMM env for one Playwright test, then run only that file.
# Usage (from repo root):
#   ./.cursor/scripts/run-migration-single-test.sh tests/leftNavigation.test.ts
#   ./.cursor/scripts/run-migration-single-test.sh tests/configuration/pmmInventory.test.ts '--database pdpgsql' false

set -euo pipefail

TEST_FILE="${1:?usage: run-migration-single-test.sh <tests/foo.test.ts> [setup_services] [setup_client]}"
SETUP_SERVICES="${2:-}"
SETUP_CLIENT="${3:-false}" # true only for standalone PMM Client/node setup outside pmm-framework provisioning
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin-password}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DOCKER_VERSION="perconalab/pmm-server:3-dev-latest"

bash "${SCRIPT_DIR}/start-docker-microvm.sh"

docker network create pmm-qa || true
docker volume create pmm-volume || true

cd "$REPO_ROOT/e2e_tests"
export ADMIN_PASSWORD
export DOCKER_VERSION
docker compose -f docker-compose.yml up -d

echo "Waiting for PMM readyz..."
bash "${SCRIPT_DIR}/wait-pmm-ready.sh" "http://127.0.0.1/v1/server/readyz"

if [[ "$SETUP_CLIENT" == "true" ]]; then
  cd "$REPO_ROOT/qa-integration/pmm_qa"
  sudo bash -x pmm3-client-setup.sh \
    --pmm_server_ip 127.0.0.1 \
    --client_version "${PMM_CLIENT_VERSION:-latest-tarball}" \
    --admin_password "$ADMIN_PASSWORD" \
    --use_metrics_mode no
fi

if [[ -n "$SETUP_SERVICES" ]]; then
  cd "$REPO_ROOT/qa-integration/pmm_qa"
  python3 -m venv virtenv
  # shellcheck disable=SC1091
  source virtenv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt setuptools
  # shellcheck disable=SC2086
  python pmm-framework.py --verbosity-level=2 --pmm-server-password="$ADMIN_PASSWORD" $SETUP_SERVICES
fi

cd "$REPO_ROOT/e2e_tests"
export PMM_UI_URL=http://127.0.0.1/
export WORKERS=1
export HEADLESS=true

npx playwright test "$TEST_FILE"
