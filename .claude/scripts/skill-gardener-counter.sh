#!/usr/bin/env bash
# Updates .claude/skill-gardener-state.json's per-skill consecutive-no-finding
# counter. Called by Claude after a skill-gardener Capture review triggered by
# .claude/hooks/skill-gardener-review.sh, and by that hook to reset a skill on
# ConfigChange. JSON is handled by node, which this repository already requires.
set -euo pipefail

skill="${1:?usage: skill-gardener-counter.sh <skill-name> <found|none|reset>}"
result="${2:?usage: skill-gardener-counter.sh <skill-name> <found|none|reset>}"

case "$result" in
  found|none|reset) ;;
  *) echo "error: result must be 'found', 'none', or 'reset'" >&2; exit 1 ;;
esac

command -v node >/dev/null 2>&1 || exit 0

SKILL="$skill" RESULT="$result" STATE="$(dirname "$0")/../skill-gardener-state.json" node -e '
const fs = require("fs");
const { SKILL, RESULT, STATE } = process.env;

let state = {};
try { state = JSON.parse(fs.readFileSync(STATE, "utf8")) } catch {}
const current = Number(state[SKILL]) || 0;
if (RESULT === "reset" && current === 0) process.exit(0);

state[SKILL] = RESULT === "none" ? current + 1 : 0;
fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");
console.log("skill-gardener: " + SKILL + " consecutive-no-finding count -> " + state[SKILL]);
'
