#!/usr/bin/env bash
# Mark a report group as being investigated, so the page and the Investigate
# button warn anyone else who starts on the same group.
# Usage: claim.sh <run_id> <suite> <by>
set -Eeuo pipefail
run_id="${1:?usage: claim.sh <run_id> <suite> <by>}"
suite="${2:?usage: claim.sh <run_id> <suite> <by>}"
by="${3:?usage: claim.sh <run_id> <suite> <by>}"
f="$(mktemp)"
trap 'rm -f "$f"' EXIT
jq -n --arg run_id "$run_id" --arg suite "$suite" --arg by "$by" --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{run_id: $run_id, claims: [{by: $by, at: $at, suites: [$suite]}]}' > "$f"
"$(dirname "$0")/publish_report.sh" "$f"
