#!/usr/bin/env bash
# Publish one investigation finding (one root cause) to a nightly report.
# Usage: finding.sh <run_id> <by> <verdict> <summary> <link|-> <suite> [suite...]
#   verdict: not reproduced | not a bug | test fix | product bug
#   link:    the fix PR or Jira bug, or - for none
# Publishing drops the same author's claim on those suites.
set -Eeuo pipefail
usage='usage: finding.sh <run_id> <by> <verdict> <summary> <link|-> <suite> [suite...]'
[ "$#" -ge 6 ] || { echo "$usage" >&2; exit 1; }
run_id="$1" by="$2" verdict="$3" summary="$4" link="$5"
shift 5
case "$verdict" in
  "not reproduced"|"not a bug"|"test fix"|"product bug") ;;
  *) echo "verdict must be one of: not reproduced, not a bug, test fix, product bug" >&2; exit 1 ;;
esac
[ "$link" = "-" ] && link=""
f="$(mktemp)"
trap 'rm -f "$f"' EXIT
jq -n --arg run_id "$run_id" --arg by "$by" --arg verdict "$verdict" --arg summary "$summary" --arg link "$link" \
  --arg at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --args '
  {run_id: $run_id, investigations: [{suites: $ARGS.positional, verdict: $verdict, summary: $summary,
    link: $link, by: $by, at: $at}]}' "$@" > "$f"
"$(dirname "$0")/publish_report.sh" "$f"
