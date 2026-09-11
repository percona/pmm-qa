#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash) -- deny `rg -r` / `--replace`.
#
# ripgrep's -r is --replace, not grep's recursion flag (rg recurses by default).
# Misread as recursion it rewrites the matched text in the output, so a search
# prints plausible-looking source that is not what the file says. The failure is
# silent and self-consistent, which is why it needs a gate rather than a note.
set -euo pipefail

input=$(cat)
command=$(jq -r '.tool_input.command // empty' <<<"$input")

[ -n "$command" ] || exit 0

# Scan each command position separately, so `-r` belonging to another command
# (xargs -r, grep -r) or sitting inside rg's own pattern never matches.
uses_rg_replace() {
  local seg cmd_seen tok cluster
  # Split on shell separators; a segment's first word is a command position.
  while IFS= read -r seg; do
    cmd_seen=""
    for tok in $seg; do
      if [ -z "$cmd_seen" ]; then
        # Skip a leading env assignment such as FOO=1 rg ...
        case "$tok" in
          *=*) continue ;;
        esac
        [ "$(basename -- "$tok")" = "rg" ] || break
        cmd_seen=1
        continue
      fi
      case "$tok" in
        --replace|--replace=*) return 0 ;;
        --*) ;;
        -*)
          cluster=${tok#-}
          case "$cluster" in
            *r*) return 0 ;;
          esac
          ;;
        # First non-flag token is the pattern; anything after it, including a
        # literal -r inside the pattern or a path, is not a flag.
        *) break ;;
      esac
    done
  done < <(printf '%s\n' "$command" | tr '|;&' '\n' | sed 's/^[[:space:]]*//')
  return 1
}

if uses_rg_replace; then
  echo "Blocked: 'rg -r/--replace' rewrites matched text in the output, so the result is not what the file contains. ripgrep recurses by default -- drop the flag, or use only -n, -l, -g and --hidden (see .claude/skills/test-cases/references/coverage.md)." >&2
  exit 2
fi

exit 0
