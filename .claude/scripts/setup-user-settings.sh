#!/usr/bin/env bash
# Plant pmm-qa's hooks + permissions as USER-scope settings
# (/root/.claude/settings.json) so they load in MULTI-REPO cloud sessions.
#
# Why: in a multi-repo session the harness roots the session at /home/user
# (the PARENT of the clones), not at a repo, and $CLAUDE_PROJECT_DIR is unset
# — so no project .claude/settings.json is ever loaded (verified live
# 2026-08-06; CLAUDE.md/agents/skills DO load, settings.json does not).
# User-scope settings load regardless of working directory, and the hooks
# already self-locate via their /home/user/pmm-qa fallback. In sessions
# where pmm-qa isn't cloned, the hook wrappers find no script and exit 0.
#
# Usage: set the cloud environment's setup script to run this file
# (bash /home/user/pmm-qa/.claude/scripts/setup-user-settings.sh) if repos
# are cloned before the setup script runs — otherwise paste this file's
# body directly as the setup script; the heredoc fallback below is
# self-contained. Copy-from-clone wins when available so the committed
# settings stay the single source of truth.
set -u

mkdir -p /root/.claude

if [ -f /home/user/pmm-qa/.claude/settings.json ]; then
  cp /home/user/pmm-qa/.claude/settings.json /root/.claude/settings.json
  echo "user-scope settings copied from pmm-qa clone"
  exit 0
fi

cat > /root/.claude/settings.json <<'EOF'
{
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Bash",
      "Read",
      "Glob",
      "Grep",
      "Edit",
      "Write",
      "MultiEdit",
      "NotebookEdit",
      "WebFetch",
      "WebSearch",
      "Task",
      "Agent",
      "TodoWrite",
      "mcp__github",
      "mcp__claude_ai_Atlassian_Rovo",
      "mcp__claude_ai_Slack",
      "mcp__claude_ai_Claude_Code_Remote"
    ]
  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "sh -c 'for d in \"$CLAUDE_PROJECT_DIR\" /home/user/pmm-qa; do h=\"$d/.claude/hooks/session-start.sh\"; [ -f \"$h\" ] && exec bash \"$h\"; done; exit 0'"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "sh -c 'for d in \"$CLAUDE_PROJECT_DIR\" /home/user/pmm-qa; do h=\"$d/.claude/hooks/block-pmm-submodules-clone.sh\"; [ -f \"$h\" ] && exec bash \"$h\"; done; exit 0'"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "sh -c 'for d in \"$CLAUDE_PROJECT_DIR\" /home/user/pmm-qa; do h=\"$d/.claude/hooks/session-end-cleanup.sh\"; [ -f \"$h\" ] && exec bash \"$h\"; done; exit 0'"
          }
        ]
      }
    ]
  }
}
EOF
echo "user-scope settings written from embedded fallback"
