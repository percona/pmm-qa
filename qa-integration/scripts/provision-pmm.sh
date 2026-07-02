#!/usr/bin/env bash
# Provision PMM Server for manual QA on MicroVM (Jenkins pmm3-aws-staging-start parity).
#
# This script only brings up Docker + PMM Server (+ optional Watchtower).
# Database/client provisioning is a separate step via pmm-framework.py so each
# ticket can choose the right --database flags.
#
# Usage:
#   export DOCKER_VERSION=perconalab/pmm-server-fb:PR-4431-c11a557
#   export CLIENT_VERSION='https://s3.../pmm-client-PR-4431-c11a557.tar.gz'
#   export ADMIN_PASSWORD='pmm3admin!'
#   ./provision-pmm.sh
#
# Options:
#   --cleanup          Remove existing PMM/QA containers before provisioning
#   --fresh-volume     Delete and recreate pmm-data volume (fixes stale ClickHouse)
#   --skip-watchtower  Do not start Watchtower (fine for pinned FB server images)
#   --profile NAME     Currently only: fb-staging (default)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
PMM_QA_DIR="${QA_ROOT}/pmm_qa"

PROFILE="fb-staging"
DO_CLEANUP=0
FRESH_VOLUME=0
SKIP_WATCHTOWER=0

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --cleanup) DO_CLEANUP=1 ;;
    --fresh-volume) FRESH_VOLUME=1 ;;
    --skip-watchtower) SKIP_WATCHTOWER=1 ;;
    --profile) PROFILE="${2:?--profile requires a value}"; shift ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown option: $1" >&2; usage 1 ;;
  esac
  shift
done

if [ "$PROFILE" != "fb-staging" ]; then
  echo "ERROR: unsupported profile '$PROFILE' (only fb-staging)" >&2
  exit 1
fi

# --- required env (from FB build / Jenkins) ---
: "${DOCKER_VERSION:?Set DOCKER_VERSION (FB server image, e.g. perconalab/pmm-server-fb:PR-4431-c11a557)}"
: "${ADMIN_PASSWORD:?Set ADMIN_PASSWORD (e.g. pmm3admin!)}"

WATCHTOWER_VERSION="${WATCHTOWER_VERSION:-perconalab/watchtower:dev-latest}"
WATCHTOWER_TOKEN="${WATCHTOWER_TOKEN:-testToken}"
CLIENT_VERSION="${CLIENT_VERSION:-3-dev-latest}"

echo "==> [1/6] Start Docker (MicroVM)"
"${SCRIPT_DIR}/start-docker-microvm.sh"

if [ "$DO_CLEANUP" = "1" ]; then
  echo "==> [2/6] Cleanup existing stack"
  REMOVE_VOLUME=$([ "$FRESH_VOLUME" = "1" ] && echo 1 || echo 0) \
    "${SCRIPT_DIR}/cleanup-pmm-microvm.sh"
else
  echo "==> [2/6] Skip cleanup (pass --cleanup to reset)"
  if [ "$FRESH_VOLUME" = "1" ]; then
    docker rm -f pmm-server watchtower 2>/dev/null || true
    docker volume rm pmm-data 2>/dev/null || true
  fi
fi

echo "==> [3/6] Networks, volumes, scratch dirs"
docker network create pmm-qa 2>/dev/null || true
if ! docker volume inspect pmm-data >/dev/null 2>&1; then
  docker volume create pmm-data
fi
mkdir -m 777 -p /tmp/backup_data

echo "==> [4/6] Pull images"
docker pull "$DOCKER_VERSION"
if [ "$SKIP_WATCHTOWER" = "0" ]; then
  docker pull "$WATCHTOWER_VERSION"
fi

echo "==> [5/6] Start Watchtower + PMM Server"
if [ "$SKIP_WATCHTOWER" = "0" ]; then
  docker rm -f watchtower 2>/dev/null || true
  docker run -d --restart=always --name watchtower \
    --network pmm-qa \
    -p 8080:8080 \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -e WATCHTOWER_HTTP_API_TOKEN="$WATCHTOWER_TOKEN" \
    "$WATCHTOWER_VERSION"
fi

docker rm -f pmm-server 2>/dev/null || true
run_args=(
  -d --restart=always
  --name pmm-server
  --hostname pmm-server
  --network pmm-qa
  -p 443:8443
  -p 4647:4647
  -v pmm-data:/srv
  -e "GF_SECURITY_ADMIN_PASSWORD=${ADMIN_PASSWORD}"
)
if [ "$SKIP_WATCHTOWER" = "0" ]; then
  run_args+=(
    -e PMM_WATCHTOWER_HOST=http://watchtower:8080
    -e "PMM_WATCHTOWER_TOKEN=${WATCHTOWER_TOKEN}"
  )
fi
# shellcheck disable=SC2068
docker run ${run_args[@]} "$DOCKER_VERSION"

echo "==> [6/6] Wait for PMM Server readyz"
"${SCRIPT_DIR}/lib/wait-pmm-ready.sh" "https://127.0.0.1/v1/server/readyz"

cat <<EOF

================================================================================
PMM Server provisioning complete (profile: ${PROFILE})
================================================================================
  UI:       https://127.0.0.1/graph/login
  User:     admin
  Password: ${ADMIN_PASSWORD}
  readyz:   https://127.0.0.1/v1/server/readyz  (expect HTTP 200, body {})

Next — provision monitored databases for your ticket (examples):

  cd ${PMM_QA_DIR}
  python3 -m venv virtenv 2>/dev/null || true
  source virtenv/bin/activate
  pip install -q -r requirements.txt

  export PMM_QA_NO_SYSTEMD=1
  export ADMIN_PASSWORD='${ADMIN_PASSWORD}'
  export CLIENT_VERSION='${CLIENT_VERSION}'

  # PMM-14576 MongoDB backup / PBM:
  python pmm-framework.py \\
    --pmm-server-password "\$ADMIN_PASSWORD" \\
    --client-version "\$CLIENT_VERSION" \\
    --database psmdb,SETUP_TYPE=pss \\
    --verbose

  # Other tickets — change --database per scripts/database_options.py, e.g.:
  #   --database ps,SETUP_TYPE=gr
  #   --database pgsql
  #   --database psmdb,SETUP_TYPE=sharding

To reset everything:
  ${SCRIPT_DIR}/provision-pmm.sh --cleanup --fresh-volume
================================================================================
EOF
