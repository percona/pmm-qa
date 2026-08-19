#!/usr/bin/env bash
# extend.sh -- reschedule a live instance's self-destruct timer, instead of
# recreating the VM, when a run needs more than its original ttl_hours.
#
# Usage:
#   terraform/linode-runner/extend.sh <run_id> <new_ttl_hours_from_now>
#
# Example: give PMM-15196's box 12 more hours from right now:
#   terraform/linode-runner/extend.sh PMM-15196 12
set -euo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_ID="${1:?usage: extend.sh <run_id> <new_ttl_hours_from_now>}"
HOURS="${2:?usage: extend.sh <run_id> <new_ttl_hours_from_now>}"

SECONDS_FROM_NOW=$((HOURS * 3600))

"$MODULE_DIR/run.sh" "$RUN_ID" -- "
  systemctl stop pmm-qa-self-destruct.timer 2>/dev/null || true
  systemctl reset-failed pmm-qa-self-destruct.timer pmm-qa-self-destruct.service 2>/dev/null || true
  systemd-run --on-active=${SECONDS_FROM_NOW} --unit=pmm-qa-self-destruct /usr/local/bin/pmm-qa-self-destruct.sh
"

echo "run_id=$RUN_ID now self-destructs in ${HOURS}h from now."
