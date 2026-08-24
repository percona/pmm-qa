#!/usr/bin/env bash
# Inject lightweight skill-gardener guidance into main and subagent turns.
set -euo pipefail

command -v node >/dev/null 2>&1 || exit 0

node -e '
let raw = "";
try { raw = require("fs").readFileSync(0, "utf8") } catch { process.exit(0) }
let input;
try { input = JSON.parse(raw) } catch { process.exit(0) }

const event = input.hook_event_name;
let context;

if (event === "UserPromptSubmit") {
  context = [
    "Continuously observe this turn for reusable workflow lessons while completing the primary task.",
    "Notice user corrections, failures followed by a better successful approach, unnecessary or repeated work, missed safe batching, and existing helpers or native tools that would save effort or tokens.",
    "Before the final response, invoke skill-gardener in Continuous mode only if a qualifying signal appeared or open subagent lesson entries need review.",
    "The main agent alone may Review, Apply, commit, push, or open PRs. If nothing qualifies, finish silently without gardening work."
  ].join(" ");
} else if (event === "SubagentStart") {
  context = [
    "Continuously observe your complete subagent sequence for reusable workflow lessons while completing your assigned task.",
    "Notice failures followed by a better successful approach, unnecessary or repeated work, missed safe batching, and existing helpers or native tools that would save effort or tokens.",
    "If a qualifying signal appears, invoke skill-gardener in Capture mode before returning and write only a unique immutable lesson entry for main-agent review.",
    "Never Review, Apply, commit, push, or open a PR from a subagent. If nothing qualifies, return normally without gardening work."
  ].join(" ");
} else {
  process.exit(0);
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: event, additionalContext: context }
}));
'
