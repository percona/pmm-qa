#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash) -- deny any git clone of pmm-submodules.
# Every agent/skill in this repo is instructed to use `gh` only against
# Percona-Lab/pmm-submodules; this hook is the deterministic backstop for
# when an agent forgets.
set -euo pipefail

input=$(cat)
command=$(jq -r '.tool_input.command // empty' <<<"$input")

if grep -qiE '\bgit\b.*\bclone\b.*pmm-submodules' <<<"$command"; then
  echo "Blocked: cloning pmm-submodules is not allowed. Use 'gh pr checks' / 'gh api' against Percona-Lab/pmm-submodules instead (see .claude/skills/repos/SKILL.md)." >&2
  exit 2
fi

exit 0
