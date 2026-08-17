#!/usr/bin/env bash
# Review completed skills on PostToolUse and reset a skill's retired counter
# when ConfigChange reports a file change in its skill directory.
# Use native jq in cloud/WSL and fall back to WSL from Windows Git Bash.
set -euo pipefail

jqw() {
  if command -v jq >/dev/null 2>&1; then
    jq "$@"
  else
    wsl -d Ubuntu -- jq "$@"
  fi
}

input=$(cat)
event=$(printf '%s' "$input" | jqw -r '.hook_event_name // empty')

if [ "$event" = "ConfigChange" ]; then
  file=$(printf '%s' "$input" | jqw -r '.file_path // empty')
  file=${file//\\//}
  case "$file" in
    */.claude/skills/*/*)
      relative=${file#*/.claude/skills/}
      skill=${relative%%/*}
      bash "$(dirname "$0")/../scripts/skill-gardener-counter.sh" "$skill" reset >/dev/null
      ;;
  esac
  exit 0
fi

skill=$(printf '%s' "$input" | jqw -r '.tool_input.skill // empty')

[ -z "$skill" ] && exit 0
[ "$skill" = "skill-gardener" ] && exit 0

state_file="$(dirname "$0")/../skill-gardener-state.json"
count=0
if [ -f "$state_file" ]; then
  count=$(jqw -r --arg s "$skill" '.[$s] // 0' < "$state_file")
fi

if [ "$count" -ge 3 ]; then
  exit 0
fi

context="The '$skill' skill just finished (auto-review pass $((count + 1)) of 3 for this skill before this review retires here). Invoke the skill-gardener skill in Capture mode against the steps just taken for '$skill' -- flag any redundant or wasted steps and record a lesson only if something new qualifies under skill-gardener's own Capture criteria. When done, run: bash .claude/scripts/skill-gardener-counter.sh '$skill' <found|none> -- pass 'found' if a new lesson was captured, 'none' if nothing new was found."

jqw -n --arg ctx "$context" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $ctx}}'
