#!/usr/bin/env bash
# Wait for the local PMM environment created by provisioning/setup.ts, then run one
# Playwright test file or an anchored grep-filtered subset. This script does not
# create or tear down that environment.
# Usage:
#   run-migration-single-test.sh <tests/file.test.ts> [--prepare-only] [--grep regex]
set -Eeuo pipefail

ensure_playwright_browser() {
  local playwright_bin="$E2E_DIR/node_modules/.bin/playwright"
  [[ -x "$playwright_bin" ]] || {
    echo "ERROR: Playwright not installed in $E2E_DIR (run: cd e2e_tests && npm ci)" >&2
    exit 2
  }
  "$playwright_bin" install chromium >/dev/null || {
    echo "ERROR: Chromium installation failed" >&2
    exit 2
  }
}

print_playwright_target() {
  (
    cd "$E2E_DIR"
    PMM_MIGRATION=1 PMM_UI_URL="$PMM_UI_URL" ADMIN_PASSWORD="$ADMIN_PASSWORD" node -e "
      const dotenv = require('dotenv');
      dotenv.config({ override: false, quiet: true });
      const url = process.env.PMM_UI_URL || 'https://127.0.0.1/';
      console.log('Playwright target: PMM_UI_URL=' + url + ' PMM_MIGRATION=' + !!process.env.PMM_MIGRATION);
    "
  )
}

run_playwright() {
  local playwright_bin="$E2E_DIR/node_modules/.bin/playwright"
  local -a cmd=("$playwright_bin" test "$TEST_FILE" "--workers=$WORKERS")
  if [[ -n "$GREP_REGEX" ]]; then
    cmd+=(--grep "$GREP_REGEX")
  fi

  print_playwright_target
  printf 'Running:'
  printf ' %q' "${cmd[@]}"
  printf '\n'

  PMM_MIGRATION=1 PMM_UI_URL="$PMM_UI_URL" ADMIN_PASSWORD="$ADMIN_PASSWORD" HEADLESS="$HEADLESS" \
    "${cmd[@]}"
}

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
  echo "usage: run-migration-single-test.sh <tests/file.test.ts> [--prepare-only] [--grep regex]" >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
E2E_DIR="$REPO_ROOT/e2e_tests"

PMM_UI_URL="${PMM_UI_URL:-https://127.0.0.1/}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
HEADLESS="${HEADLESS:-true}"
WORKERS="${WORKERS:-1}"
export ADMIN_PASSWORD PMM_MIGRATION=1 PMM_UI_URL HEADLESS WORKERS

READYZ_URL="${PMM_UI_URL%/}/v1/server/readyz"
READYZ_BODY_FILE="${TMPDIR:-/tmp}/pmm-readyz-body.txt"

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

[[ -f "$E2E_DIR/$TEST_FILE" ]] || {
  echo "ERROR: target test does not exist: $E2E_DIR/$TEST_FILE" >&2
  exit 2
}

if ! readyz_once; then
  wait_readyz || {
    echo "ERROR: could not reach the local PMM environment at ${PMM_UI_URL}. Provision it first with node provisioning/setup.ts." >&2
    exit 2
  }
fi

ensure_playwright_browser

if [[ "$PREPARE_ONLY" == "true" ]]; then
  echo "PMM environment at ${PMM_UI_URL} is ready."
  echo "PMM_UI_URL=${PMM_UI_URL} ADMIN_PASSWORD=***"
  exit 0
fi

cd "$E2E_DIR"
run_playwright
