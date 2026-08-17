#!/usr/bin/env bash
# Updates .claude/skill-gardener-state.json's per-skill consecutive-no-finding
# counter. Called by Claude after a skill-gardener Capture review triggered by
# .claude/hooks/skill-gardener-review.sh. Use native jq in cloud/WSL and fall
# back to WSL from Windows Git Bash.
set -euo pipefail

skill="${1:?usage: skill-gardener-counter.sh <skill-name> <found|none|reset>}"
result="${2:?usage: skill-gardener-counter.sh <skill-name> <found|none|reset>}"

jqw() {
  if command -v jq >/dev/null 2>&1; then
    jq "$@"
  else
    wsl -d Ubuntu -- jq "$@"
  fi
}

state_file="$(dirname "$0")/../skill-gardener-state.json"

if [ "$result" = "reset" ]; then
  [ -f "$state_file" ] || exit 0
  current=$(jqw -r --arg s "$skill" '.[$s] // 0' < "$state_file")
  [ "$current" -eq 0 ] && exit 0
fi

[ -f "$state_file" ] || echo '{}' > "$state_file"

if [ "$result" = "found" ] || [ "$result" = "reset" ]; then
  new_count=0
elif [ "$result" = "none" ]; then
  current=$(jqw -r --arg s "$skill" '.[$s] // 0' < "$state_file")
  new_count=$((current + 1))
else
  echo "error: result must be 'found', 'none', or 'reset'" >&2
  exit 1
fi

tmp="$(mktemp)"
jqw --arg s "$skill" --argjson c "$new_count" '.[$s] = $c' < "$state_file" > "$tmp" && mv "$tmp" "$state_file"
echo "skill-gardener: '$skill' consecutive-no-finding count -> $new_count"
