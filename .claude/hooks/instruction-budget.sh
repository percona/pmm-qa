#!/usr/bin/env bash
# Word budget for instruction files that load whole into a session: skill
# bodies, agent files, CLAUDE.md, AGENTS.md. Prints words and the delta against
# a base ref per file; fails when a file over budget has grown.
#
# Usage: instruction-budget.sh [base-ref]   (default origin/main)
set -uo pipefail

QA_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$QA_ROOT" || exit 1

base="${1:-origin/main}"
budget="${INSTRUCTION_BUDGET:-1500}"

body_words() { awk 'NR==1 && /^---$/ {fm=1; next} fm && /^---$/ {fm=0; next} !fm' | wc -w; }

rc=0
printf '%-52s %6s %6s %7s\n' file words budget delta
for f in .claude/skills/*/SKILL.md .claude/agents/*.md CLAUDE.md AGENTS.md; do
  now=$(body_words < "$f")
  was=$(git show "$base:$f" 2>/dev/null | body_words)
  delta=$((now - was))
  flag=
  if [ "$now" -gt "$budget" ] && [ "$delta" -gt 0 ]; then flag='  OVER BUDGET AND GREW'; rc=1; fi
  printf '%-52s %6d %6d %+7d%s\n' "$f" "$now" "$budget" "$delta" "$flag"
done
exit "$rc"
