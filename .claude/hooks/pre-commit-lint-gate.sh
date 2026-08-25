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
# `git` is matched wherever it appears as a word, not only at the start of a
# command or after a separator: anchoring on separators let every wrapper form
# through -- `sudo git commit`, `env GIT_EDITOR=true git commit`,
# `time git commit`, `if git commit; then ...`. The leading class excludes `-`
# and word characters so `github` and `--git` do not match, and requiring
# whitespace after `git` keeps it a whole token. This does match `git commit`
# inside a quoted string, which only costs a redundant lint of the staged files
# and still allows the call when they are clean -- the safe direction.
grep -qE "(^|[^[:alnum:]_-])git([[:space:]]+${git_token})*[[:space:]]+commit([[:space:]]|\$)" \
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
