#!/usr/bin/env bash
# Log into PMM UI via playwright-cli (Cloud Agent / MicroVM).
# Avoids the Grafana login form and self-signed TLS issues.
#
# Usage:
#   export PMM_URL='https://127.0.0.1'      # optional, default below
#   export ADMIN_PASSWORD='pmm3admin!'        # optional; match provision-pmm.sh
#   qa-integration/scripts/pmm-ui-login.sh PMM-14576
#
# Session name: pmm-<SESSION_ID> (reuse the same id for follow-up UI commands).
# Opens headed by default (better for screen recordings). Set PMM_UI_HEADED=0 for headless.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PW_CONFIG="${REPO_ROOT}/.playwright/cli.config.json"

SESSION_ID="${1:?usage: $0 <SESSION_ID>  e.g. PMM-14576}"
PMM_URL="${PMM_URL:-https://127.0.0.1}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-pmm3admin!}"
PLAYWRIGHT_SESSION="pmm-${SESSION_ID}"

export PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS="${PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS:-1}"
export DISPLAY="${DISPLAY:-:1}"

if ! command -v playwright-cli >/dev/null 2>&1; then
  echo "ERROR: playwright-cli not found on PATH" >&2
  exit 1
fi

AUTH_TOKEN="$(printf 'admin:%s' "$ADMIN_PASSWORD" | base64 -w0 2>/dev/null || printf 'admin:%s' "$ADMIN_PASSWORD" | base64)"

PW_CLI=(playwright-cli --config="$PW_CONFIG")
OPEN_ARGS=(-s="$PLAYWRIGHT_SESSION" open --headed "$PMM_URL")
if [ "${PMM_UI_HEADED:-1}" = "0" ]; then
  OPEN_ARGS=(-s="$PLAYWRIGHT_SESSION" open "$PMM_URL")
fi

"${PW_CLI[@]}" "${OPEN_ARGS[@]}"

# shellcheck disable=SC2016
"${PW_CLI[@]}" -s="$PLAYWRIGHT_SESSION" run-code "async page => {
  const base = page.url().match(/^https?:\\/\\/[^/]+/)[0];
  await page.setExtraHTTPHeaders({ Authorization: 'Basic ${AUTH_TOKEN}' });
  await page.route('**/api/user/auth-tokens/rotate', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/v1/users/me', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ alerting_tour_completed: true, product_tour_completed: true, snoozed_pmm_version: '', user_id: 1 }) }));
  await page.route('**/v1/server/updates?force=**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ installed: {}, last_check: new Date().toISOString(), latest: {}, update_available: false }) }));
  const res = await page.request.post(base + '/graph/login', { data: { user: 'admin', password: '${ADMIN_PASSWORD}' } });
  if (res.status() >= 400) throw new Error('Login failed: HTTP ' + res.status() + ' ' + await res.text());
  await page.goto(base + '/pmm-ui/help');
}"

echo "PMM UI login OK (session=${PLAYWRIGHT_SESSION}, url=${PMM_URL})"
