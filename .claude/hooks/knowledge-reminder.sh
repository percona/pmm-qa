#!/usr/bin/env bash
# PreToolUse hook -- points the turn at the file that already documents a tool's
# pitfalls, on the first call to that tool.
#
# Context only: it never blocks a call and never changes one.
set -euo pipefail

[ "${PMM_KNOWLEDGE_REMINDER:-on}" = "off" ] && exit 0

command -v node >/dev/null 2>&1 || exit 0

# One reminder per tool family per session. Each hook invocation is its own
# process, so the marker is keyed on the session -- taken from the hook payload,
# which carries it whether or not the harness exports CLAUDE_CODE_SESSION_ID.
STATE_DIR="${TMPDIR:-/tmp}/pmm-knowledge-reminder"

STATE_DIR="$STATE_DIR" node -e '
let raw = "";
try { raw = require("fs").readFileSync(0, "utf8") } catch { process.exit(0) }
let input;
try { input = JSON.parse(raw) } catch { process.exit(0) }

const tool = input.tool_name || "";

// [pattern, marker, reminder]
const RULES = [
  [/^mcp__Percona[-_]Jenkins[-_]MCP__/, "jenkins",
   "Reading a Jenkins build: .claude/skills/jenkins-builds/SKILL.md owns this. An IN_PROGRESS build reports SUCCESS for branches still running — a near-zero or negative stage duration is the tell — and the per-stage status, not an error line in the console, identifies the failing stage."],
  [/(^|__)get_job_logs$/, "joblogs",
   "One tail attempt only. A tail window reaches the trailing steps, not the failing one, and growing tail_lines costs thousands of tokens per retry — see .claude/agents/investigator.md. On a public repo, https://api.github.com/repos/<owner>/<repo>/actions/jobs/<job_id>/logs returns the whole log unauthenticated."],
];

const hit = RULES.find(([re]) => re.test(tool));
if (!hit) process.exit(0);

const session = input.session_id || process.env.CLAUDE_CODE_SESSION_ID || "nosession";
const marker = process.env.STATE_DIR + "-" + session + "-" + hit[1];
const fs = require("fs");

// Nothing sweeps these markers, and a payload without a session id falls back to
// a key shared by every session on this box, which would suppress the reminder
// for good. Expiring the marker bounds that to "fires again later".
const MAX_AGE_MS = 12 * 60 * 60 * 1000;
try {
  if (Date.now() - fs.statSync(marker).mtimeMs > MAX_AGE_MS) fs.unlinkSync(marker);
} catch { /* no marker yet, or it vanished under us -- the write below decides */ }

try {
  fs.writeFileSync(marker, "", { flag: "wx" });
} catch {
  process.exit(0); // already reminded this session
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: hit[2] }
}));
'
