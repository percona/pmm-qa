#!/usr/bin/env bash
# Provision PMM and run one Playwright test file or an anchored grep-filtered subset.
# Usage:
#   run-migration-single-test.sh <tests/file.test.ts> [setup_services] [setup_client] [--prepare-only] [--grep regex]
set -Eeuo pipefail

POSITIONAL_ARGS=()
GREP_REGEX=""
PREPARE_ONLY="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prepare-only)
      PREPARE_ONLY="true"
      shift
      ;;
    --grep)
      GREP_REGEX="${2:?--grep requires a regex}"
      shift 2
      ;;
    -*)
      echo "ERROR: unknown argument: $1" >&2
      exit 2
      ;;
    *)
      POSITIONAL_ARGS+=("$1")
      shift
      ;;
  esac
done

TEST_FILE="${POSITIONAL_ARGS[0]:-}"
if [[ -z "$TEST_FILE" ]]; then
  echo "usage: run-migration-single-test.sh <tests/file.test.ts> [setup_services] [setup_client] [--prepare-only] [--grep regex]" >&2
  exit 2
fi

SETUP_SERVICES="${POSITIONAL_ARGS[1]:-}"
SETUP_CLIENT="${POSITIONAL_ARGS[2]:-false}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
E2E_DIR="$REPO_ROOT/e2e_tests"
QA_DIR="$REPO_ROOT/qa-integration/pmm_qa"
COMPOSE_FILE="$E2E_DIR/docker-compose.yml"

ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin-password}"
DOCKER_VERSION="${DOCKER_VERSION:-perconalab/pmm-server:3-dev-latest}"
CLEAN_ENVIRONMENT="${CLEAN_ENVIRONMENT:-true}"
READYZ_URL="http://127.0.0.1/v1/server/readyz"
READYZ_BODY_FILE="${TMPDIR:-/tmp}/pmm-readyz-body.txt"
export ADMIN_PASSWORD DOCKER_VERSION

cleanup_pmm_qa_containers() {
  docker network inspect pmm-qa -f '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' 2>/dev/null |
    while read -r name; do
      [[ -z "$name" || "$name" == "pmm-server" ]] && continue
      docker rm -f "$name" >/dev/null 2>&1 || true
    done
}

readyz_once() {
  READYZ_HTTP_CODE=$(curl -ksS -o "$READYZ_BODY_FILE" -w '%{http_code}' --user "admin:${ADMIN_PASSWORD}" "$READYZ_URL" 2>/dev/null || echo "000")
  touch "$READYZ_BODY_FILE" 2>/dev/null || true
  READYZ_BODY=$(tr -d '[:space:]' <"$READYZ_BODY_FILE" 2>/dev/null || true)
  [[ "$READYZ_HTTP_CODE" == "200" && ( -z "$READYZ_BODY" || "$READYZ_BODY" == "{}" || "$READYZ_BODY" == "OK" ) ]]
}

wait_readyz() {
  local timeout_sec="${PMM_READY_TIMEOUT:-600}"
  local interval_sec="${PMM_READY_INTERVAL:-5}"
  local elapsed=0
  local preview

  while [[ "$elapsed" -lt "$timeout_sec" ]]; do
    if readyz_once; then
      echo "PMM Server is ready (${READYZ_URL} -> HTTP 200, body=${READYZ_BODY:-empty})"
      return 0
    fi

    preview=$(head -c 120 "$READYZ_BODY_FILE" 2>/dev/null | tr '\n' ' ' || true)
    echo "waiting for readyz... HTTP ${READYZ_HTTP_CODE} (${elapsed}s/${timeout_sec}s) ${preview}"
    sleep "$interval_sec"
    elapsed=$((elapsed + interval_sec))
  done

  echo "ERROR: PMM Server not ready after ${timeout_sec}s (${READYZ_URL})" >&2
  return 1
}

cleanup() {
  local code=$?
  if (( code != 0 )); then
    echo "=== PMM compose status ===" >&2
    docker compose -f "$COMPOSE_FILE" ps >&2 || true
    echo "=== PMM compose logs ===" >&2
    docker compose -f "$COMPOSE_FILE" logs --tail=200 >&2 || true
  fi
  exit "$code"
}
trap cleanup EXIT

[[ -f "$E2E_DIR/$TEST_FILE" ]] || {
  echo "ERROR: target test does not exist: $E2E_DIR/$TEST_FILE" >&2
  exit 2
}

bash "$SCRIPT_DIR/start-docker-microvm.sh"

if [[ "$CLEAN_ENVIRONMENT" == "false" ]]; then
  if ! readyz_once; then
    echo "ERROR: CLEAN_ENVIRONMENT=false requires an existing prepared PMM environment. Run with --prepare-only first." >&2
    exit 2
  fi
elif [[ "$CLEAN_ENVIRONMENT" != "true" ]]; then
  echo "ERROR: CLEAN_ENVIRONMENT must be true or false" >&2
  exit 2
fi

if [[ "$CLEAN_ENVIRONMENT" == "true" ]]; then
  docker network inspect pmm-qa >/dev/null 2>&1 || docker network create pmm-qa
  cleanup_pmm_qa_containers

  docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans || true
  docker volume rm pmm-volume >/dev/null 2>&1 || true
  docker volume inspect pmm-volume >/dev/null 2>&1 || docker volume create pmm-volume

  cd "$E2E_DIR"
  docker compose -f "$COMPOSE_FILE" up -d

  wait_readyz

  if [[ "$SETUP_CLIENT" == "true" ]]; then
    cd "$QA_DIR"
    sudo bash -x pmm3-client-setup.sh \
      --pmm_server_ip 127.0.0.1 \
      --client_version "${PMM_CLIENT_VERSION:-latest-tarball}" \
      --admin_password "$ADMIN_PASSWORD" \
      --use_metrics_mode no
  elif [[ "$SETUP_CLIENT" != "false" ]]; then
    echo "ERROR: setup_client must be true or false" >&2
    exit 2
  fi

  if [[ -n "$SETUP_SERVICES" ]]; then
    cd "$QA_DIR"
    export IS_CURSOR_VM="${IS_CURSOR_VM:-1}"
    export PMM_QA_NO_SYSTEMD="${PMM_QA_NO_SYSTEMD:-1}"
    export DOCKER_HOST="${DOCKER_HOST:-unix:///var/run/docker.sock}"

    if [[ ! -x virtenv/bin/python ]]; then
      python3 -m venv virtenv
      virtenv/bin/pip install --upgrade pip
      virtenv/bin/pip install -r requirements.txt setuptools
    fi

    # The canonical interface currently accepts setup_services as one shell-like string.
    read -r -a setup_args <<< "$SETUP_SERVICES"
    virtenv/bin/python pmm-framework.py \
      --verbosity-level=2 \
      --pmm-server-password="$ADMIN_PASSWORD" \
      "${setup_args[@]}"
  fi
elif [[ "$SETUP_CLIENT" != "true" && "$SETUP_CLIENT" != "false" ]]; then
  echo "ERROR: setup_client must be true or false" >&2
  exit 2
fi

if [[ "$PREPARE_ONLY" == "true" ]]; then
  echo "PMM migration environment is ready. Reuse it with CLEAN_ENVIRONMENT=false."
  exit 0
fi

cd "$E2E_DIR"
export PMM_UI_URL="${PMM_UI_URL:-http://127.0.0.1/}"
export HEADLESS="${HEADLESS:-true}"
export WORKERS="${WORKERS:-1}"

cmd=(npx playwright test "$TEST_FILE" --workers="$WORKERS")
if [[ -n "$GREP_REGEX" ]]; then
  cmd+=(--grep "$GREP_REGEX")
fi

printf 'Running:'
printf ' %q' "${cmd[@]}"
printf '\n'
"${cmd[@]}"