#!/usr/bin/env bash
# Block cloning Percona-Lab/pmm-submodules — use gh only.
input=$(cat)
command=$(echo "$input" | jq -r '.command // empty')

if echo "$command" | grep -qiE 'git\s+clone.*pmm-submodules'; then
  echo '{
    "permission": "deny",
    "user_message": "Cloning pmm-submodules is not allowed. Use gh pr checks and gh api on Percona-Lab/pmm-submodules instead.",
    "agent_message": "Never clone pmm-submodules. Use gh only per pmm-repos skill."
  }'
  exit 0
fi

echo '{ "permission": "allow" }'
exit 0
