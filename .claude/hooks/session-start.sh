#!/usr/bin/env bash
# SessionStart hook -- installs gh, terraform, the linters the commit gate and
# .github/workflows/lint.yml run, ffmpeg, json-diff, and the Playwright helper
# scripts. Everything else (PMM, pmm-framework, Ansible) runs on the Linode VM,
# not here -- see .claude/skills/linode-docker-provisioning.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

QA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=.claude/hooks/lib/install-linters.sh
. "$QA_ROOT/.claude/hooks/lib/install-linters.sh"

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
  TF_VERSION="1.9.8"
  TF_FILE="terraform_${TF_VERSION}_linux_${ARCH}.zip"
  TF_ZIP="$(mktemp)"
  TF_SHASUMS="$(mktemp)"
  trap 'rm -f "$TF_ZIP" "$TF_SHASUMS"' EXIT
  curl -fsSL -o "$TF_ZIP" \
    "https://releases.hashicorp.com/terraform/${TF_VERSION}/${TF_FILE}"
  curl -fsSL -o "$TF_SHASUMS" \
    "https://releases.hashicorp.com/terraform/${TF_VERSION}/terraform_${TF_VERSION}_SHA256SUMS"
  EXPECTED_SHA=$(grep " ${TF_FILE}\$" "$TF_SHASUMS" | awk '{print $1}')
  ACTUAL_SHA=$(sha256sum "$TF_ZIP" | awk '{print $1}')
  if [ -z "$EXPECTED_SHA" ] || [ "$EXPECTED_SHA" != "$ACTUAL_SHA" ]; then
    echo "terraform archive checksum mismatch for $TF_FILE -- aborting install" >&2
    exit 1
  fi
  sudo unzip -o -q "$TF_ZIP" -d /usr/local/bin terraform
fi

# --- linters -- shellcheck, yamllint, actionlint, hadolint, ruff --------
ensure_all_linters || true

# --- ffmpeg -- only for pw-record.js's .webm -> .mp4 transcode ---------
command -v ffmpeg >/dev/null 2>&1 || (sudo apt-get update -qq && sudo apt-get install -y ffmpeg)

# --- json-diff (large Grafana dashboard JSON PR diffs) -------------------
command -v json-diff >/dev/null 2>&1 || npm install -g json-diff >/dev/null 2>&1 || true

# --- Playwright helper scripts -- browsers are pre-installed already ----
cd "$QA_ROOT/.claude/scripts"
npm install >/dev/null

chmod +x "$QA_ROOT"/terraform/linode-runner/*.sh "$QA_ROOT"/.claude/hooks/*.sh "$QA_ROOT"/.claude/hooks/lib/*.sh
