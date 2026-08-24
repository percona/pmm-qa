#!/usr/bin/env bash
# Inject lightweight skill-gardener guidance into main and subagent turns.
set -euo pipefail

[ "${SKILL_GARDENER:-on}" = "off" ] && exit 0

command -v node >/dev/null 2>&1 || exit 0

node -e '
let raw = "";
try { raw = require("fs").readFileSync(0, "utf8") } catch { process.exit(0) }
let input;
try { input = JSON.parse(raw) } catch { process.exit(0) }

const event = input.hook_event_name;
let context;

if (event === "UserPromptSubmit") {
  context = "Notice reusable workflow lessons this turn: a correction, a failed approach then a better one, repeated or unbatched work, an unused helper. If one appears, invoke skill-gardener to record it; otherwise finish silently.";
} else if (event === "SubagentStart") {
  context = "Notice reusable workflow lessons in your sequence: a failed approach then a better one, repeated or unbatched work, an unused helper. If one appears, invoke skill-gardener to write a lesson entry; never commit, push, or open a PR.";
} else {
  process.exit(0);
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: event, additionalContext: context }
}));
'
