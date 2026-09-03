#!/usr/bin/env bash
# Request a skill-gardener Capture pass after a codeceptjs-migration subagent phase ends.
# Exits silently for every other Agent call. JSON is parsed with node, which this repository
# already requires.
set -euo pipefail

command -v node >/dev/null 2>&1 || exit 0

obs=".claude/migration-observations/"

template="The '{phase}' migration phase just finished. Invoke the skill-gardener skill in Capture mode against that phase. Read its row in the current migration's timeline under {obs} for durations, loop count, retries, and what it was blocked on, and audit the observable tool and command sequence for repeated reads or searches, avoidable failed retries, unnecessary setup, and serial work that was safe to overlap. Record a parallelization finding by updating the matching row in .claude/skills/codeceptjs-migration/parallelization-ledger.md, not as a lesson. Record a lesson only if something else qualifies under skill-gardener's Capture criteria; a lesson targeting a migration file is branch-local, so it goes to .claude/skill-lessons-migration/ on the control branch, never to the shared daily branch, and is never applied without the user asking. Do not create a raw command log, do not optimize away required verification, and do not delay the migration."

OBS="$obs" TEMPLATE="$template" node -e '
const AGENTS = new Set([
  "pmm-migration-writer",
  "pmm-migration-reviewer",
  "pmm-migration-runner",
]);

let raw = "";
try { raw = require("fs").readFileSync(0, "utf8") } catch { process.exit(0) }
let h;
try { h = JSON.parse(raw) } catch { process.exit(0) }

const phase = String((h.tool_input || {}).subagent_type || "");
if (!AGENTS.has(phase)) process.exit(0);

const ctx = process.env.TEMPLATE.split("{phase}").join(phase).split("{obs}").join(process.env.OBS);
process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: ctx },
}) + "\n");
'
