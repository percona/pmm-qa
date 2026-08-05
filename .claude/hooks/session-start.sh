#!/usr/bin/env bash
# SessionStart hook -- installs gh, terraform, ffmpeg, json-diff, and the
# Playwright helper scripts. Everything else (PMM, pmm-framework, Ansible)
# runs on the Linode VM, not here -- see .claude/skills/pmm-linode-provisioning.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

QA_ROOT="$CLAUDE_PROJECT_DIR"

# --- gh CLI -----------------------------------------------------------
if ! command -v gh >/dev/null 2>&1; then
  curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null
  sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null
  sudo apt-get update -qq && sudo apt-get install -y gh
fi

# --- terraform ----------------------------------------------------------
if ! command -v terraform >/dev/null 2>&1; then
  ARCH=$(dpkg --print-architecture)
  TF_ZIP="$(mktemp)"
  trap 'rm -f "$TF_ZIP"' EXIT
  curl -fsSL -o "$TF_ZIP" \
    "https://releases.hashicorp.com/terraform/1.9.8/terraform_1.9.8_linux_${ARCH}.zip"
  sudo unzip -o -q "$TF_ZIP" -d /usr/local/bin terraform
fi

# --- ffmpeg -----------------------------------------------------------
# Playwright records its own .webm directly (no ffmpeg needed for capture);
# this is only for pw-record.js's transcode to .mp4 for easier viewing/
# attaching to Jira.
command -v ffmpeg >/dev/null 2>&1 || (sudo apt-get update -qq && sudo apt-get install -y ffmpeg)

# --- json-diff (large Grafana dashboard JSON PR diffs) -------------------
command -v json-diff >/dev/null 2>&1 || npm install -g json-diff >/dev/null 2>&1 || true

# --- Playwright helper scripts (UI login / screenshots) -------------------
# Browsers are already pre-installed and PLAYWRIGHT_BROWSERS_PATH already
# points at them -- this only needs the `playwright` node module itself.
cd "$QA_ROOT/.claude/scripts"
npm install >/dev/null

chmod +x "$QA_ROOT"/terraform/linode-runner/*.sh \
  "$QA_ROOT"/.claude/hooks/*.sh 2>/dev/null || true
