#!/usr/bin/env bash
# Wait until PMM Server readyz returns HTTP 200. If the body is present, it must be either "{}" or contain "OK".
set -euo pipefail

READYZ_URL="${1:-${PMM_READY_URL:-http://127.0.0.1/v1/server/readyz}}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin-password}"
TIMEOUT_SEC="${PMM_READY_TIMEOUT:-300}"
INTERVAL_SEC="${PMM_READY_INTERVAL:-5}"
BODY_FILE="${TMPDIR:-/tmp}/pmm-readyz-body.txt"

elapsed=0
while [ "$elapsed" -lt "$TIMEOUT_SEC" ]; do
  http_code=$(curl -ksS -o "$BODY_FILE" -w '%{http_code}' --user "admin:${ADMIN_PASSWORD}" "$READYZ_URL" 2>/dev/null || echo "000")
  body=$(tr -d '[:space:]' <"$BODY_FILE" 2>/dev/null || true)

  if [ "$http_code" = "200" ] && { [ -z "$body" ] || [ "$body" = "{}" ] || [ "$body" = "OK" ]; }; then
    echo "PMM Server is ready (${READYZ_URL} -> HTTP 200, body=${body:-empty})"
    exit 0
  fi

  preview=$(head -c 120 "$BODY_FILE" 2>/dev/null | tr '\n' ' ' || true)
  echo "waiting for readyz... HTTP ${http_code} (${elapsed}s/${TIMEOUT_SEC}s) ${preview}"
  sleep "$INTERVAL_SEC"
  elapsed=$((elapsed + INTERVAL_SEC))
done

echo "ERROR: PMM Server not ready after ${TIMEOUT_SEC}s (${READYZ_URL})" >&2
exit 1