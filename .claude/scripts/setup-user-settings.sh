#!/usr/bin/env bash
# Plant pmm-qa's hooks + permissions as USER-scope settings
# (/root/.claude/settings.json) so they load in MULTI-REPO cloud sessions.
#
# Why: in a multi-repo session the harness roots the session at /home/user
# (the PARENT of the clones), not at a repo, and $CLAUDE_PROJECT_DIR is unset
# — so no project .claude/settings.json is ever loaded (verified live
# 2026-08-06; CLAUDE.md/agents/skills DO load, settings.json does not).
#
# Usage: set the cloud environment's setup script to this file's body (it is
# self-contained). Source of truth is .claude/settings.json on main: a local
# clone wins when present, otherwise it's fetched from raw.githubusercontent
# (in the default Trusted allowlist). The setup-script result is snapshot-
# cached ~7 days, so settings changes on main reach environments on the next
# cache rebuild.
#
# Must exit 0 — a non-zero setup script blocks session start.

mkdir -p /root/.claude

if [ -f /home/user/pmm-qa/.claude/settings.json ]; then
  cp /home/user/pmm-qa/.claude/settings.json /root/.claude/settings.json \
    && echo "user-scope settings copied from pmm-qa clone"
elif curl -fsSL --max-time 30 \
    https://raw.githubusercontent.com/percona/pmm-qa/main/.claude/settings.json \
    -o /root/.claude/settings.json; then
  echo "user-scope settings fetched from percona/pmm-qa@main"
else
  echo "WARNING: could not obtain pmm-qa settings.json; hooks/permissions will be absent in multi-repo sessions" >&2
fi

exit 0
