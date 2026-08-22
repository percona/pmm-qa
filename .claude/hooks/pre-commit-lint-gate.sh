#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash) -- lints the staged files before a `git commit`
# is allowed to run, and denies the tool call (exit 2) when a linter fails.
# The husky pre-commit hook cannot cover this: core.hooksPath is only set by
# e2e_tests' npm `prepare`, which never runs in a cloud session.
set -uo pipefail

# $0, never CLAUDE_PROJECT_DIR -- in a cloud session that variable resolves to
# the parent directory holding several clones, so a hook keyed on it silently
# never finds its own repo.
QA_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

input=$(cat)
command=$(jq -r '.tool_input.command // empty' <<<"$input")

# A git option's argument may be quoted -- `git -C "$REPO" commit`,
# `git -c user.name="A B" commit` -- and a character class of bare option
# characters silently misses every one of those, letting an ordinary commit past
# the gate. Tokens are matched as quoted-or-unquoted instead.
git_token='("[^"]*"|'"'"'[^'"'"']*'"'"'|[^[:space:];&|()]+)'
grep -qE "(^|[;&|(]|&&|\|\|)[[:space:]]*git([[:space:]]+${git_token})*[[:space:]]+commit([[:space:]]|\$)" \
  <<<"$command" || exit 0

# Only gate commits landing in pmm-qa; sibling clones have their own tooling.
repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
[ "$repo_root" = "$QA_ROOT" ] || exit 0

if grep -qE '(^|[[:space:]])(-[a-zA-Z]*a[a-zA-Z]*|--all)([[:space:]]|$)' <<<"$command"; then
  mapfile -t changed < <(git -C "$QA_ROOT" diff --name-only --diff-filter=ACMR HEAD)
else
  mapfile -t changed < <(git -C "$QA_ROOT" diff --cached --name-only --diff-filter=ACMR)
fi

[ ${#changed[@]} -eq 0 ] && exit 0

output=$(bash "$QA_ROOT/.claude/hooks/lint-changed.sh" "${changed[@]}" 2>&1)
status=$?

if [ $status -ne 0 ]; then
  {
    echo "Blocked: lint gate failed for the staged files. Fix these, then commit again."
    echo "$output"
    echo
    echo "Re-run manually: .claude/hooks/lint-changed.sh <files>"
  } >&2
  exit 2
fi

exit 0
