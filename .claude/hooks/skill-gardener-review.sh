#!/usr/bin/env bash
# Review completed skills on PostToolUse and reset a skill's retired counter
# when ConfigChange reports a file change in its skill directory.
# JSON is parsed with node, which this repository already requires.
set -euo pipefail

command -v node >/dev/null 2>&1 || exit 0

here="$(dirname "$0")"

template="The '{skill}' skill just finished (auto-review pass {n} of 3 for this skill before this review retires here). Invoke the skill-gardener skill in Capture mode against the observable tool and command sequence for '{skill}'. Check for repeated reads or searches, avoidable failed retries, unnecessary setup or dependencies, safe parallelization opportunities, and existing helpers or native tools that could replace custom commands. Do not create a raw command log or optimize away required verification. Record a lesson only if something new qualifies under skill-gardener's Capture criteria. When done, run: bash .claude/scripts/skill-gardener-counter.sh '{skill}' <found|none> -- pass 'found' if a new lesson was captured, 'none' if nothing new was found."

action=$(STATE="$here/../skill-gardener-state.json" TEMPLATE="$template" node -e '
const fs = require("fs");
const SKILLS_DIR = "/.claude/skills/";

let raw = "";
try { raw = fs.readFileSync(0, "utf8") } catch { process.exit(0) }
let h;
try { h = JSON.parse(raw) } catch { process.exit(0) }

if (h.hook_event_name === "ConfigChange") {
  const path = String(h.file_path || "").split(String.fromCharCode(92)).join("/");
  const at = path.indexOf(SKILLS_DIR);
  if (at < 0) process.exit(0);
  const rest = path.slice(at + SKILLS_DIR.length);
  if (rest.indexOf("/") > 0) process.stdout.write("reset " + rest.split("/")[0]);
  process.exit(0);
}

const skill = (h.tool_input || {}).skill || "";
if (!skill || skill === "skill-gardener") process.exit(0);

let state = {};
try { state = JSON.parse(fs.readFileSync(process.env.STATE, "utf8")) } catch {}
const count = Number(state[skill]) || 0;
if (count >= 3) process.exit(0);

const ctx = process.env.TEMPLATE.split("{skill}").join(skill).split("{n}").join(count + 1);
process.stdout.write("emit " + JSON.stringify({
  hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: ctx },
}));
')

case "$action" in
  "reset "*) bash "$here/../scripts/skill-gardener-counter.sh" "${action#reset }" reset >/dev/null ;;
  "emit "*) printf '%s\n' "${action#emit }" ;;
esac
