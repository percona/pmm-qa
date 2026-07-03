#!/usr/bin/env bash
# Wait until PMM Server readyz returns HTTP 200 and body "{}".
# Usage: wait-pmm-ready.sh [readyz-url]
set -euo pipefail

READYZ_URL="${1:-${PMM_READY_URL:-https://127.0.0.1/v1/server/readyz}}"
TIMEOUT_SEC="${PMM_READY_TIMEOUT:-600}"
INTERVAL_SEC="${PMM_READY_INTERVAL:-5}"

elapsed=0
while [ "$elapsed" -lt "$TIMEOUT_SEC" ]; do
  http_code=$(curl -ksS -o /tmp/pmm-readyz-body.txt -w '%{http_code}' "$READYZ_URL" 2>/dev/null || echo "000")
  touch /tmp/pmm-readyz-body.txt 2>/dev/null || true
  body=$(tr -d '[:space:]' </tmp/pmm-readyz-body.txt 2>/dev/null || true)

  if [ "$http_code" = "200" ] && [ "$body" = "{}" ]; then
    echo "PMM Server is ready (${READYZ_URL} → HTTP 200, body={})"
    exit 0
  fi

  preview=$(head -c 120 /tmp/pmm-readyz-body.txt 2>/dev/null | tr '\n' ' ')
  echo "waiting for readyz... HTTP ${http_code} (${elapsed}s/${TIMEOUT_SEC}s) ${preview}"
  sleep "$INTERVAL_SEC"
  elapsed=$((elapsed + INTERVAL_SEC))
done

echo "ERROR: PMM Server not ready after ${TIMEOUT_SEC}s (${READYZ_URL})" >&2
exit 1
