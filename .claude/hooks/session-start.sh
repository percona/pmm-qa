#!/usr/bin/env bash
# SessionStart hook -- installs what the pmm-qa cloud agents need.
#
# Deliberately does NOT set up local Docker/dockerd: PMM + monitored
# databases now run on a throwaway Linode VM (see
# .claude/skills/pmm-linode-provisioning), not inside this container. This
# hook only needs to prepare the *controller* side: gh, terraform, the
# Ansible/Python tooling pmm-framework's remote run depends on being present
# in the synced qa-integration/ tree, and the local Playwright helper
# scripts used for UI evidence.
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
  curl -fsSL -o /tmp/terraform.zip \
    "https://releases.hashicorp.com/terraform/1.9.8/terraform_1.9.8_linux_${ARCH}.zip"
  sudo unzip -o -q /tmp/terraform.zip -d /usr/local/bin terraform
  rm -f /tmp/terraform.zip
fi

# --- ssh client + rsync ---------------------------------------------------
# Not present in the base image -- terraform/linode-runner/up.sh and run.sh
# need both to reach the provisioned Linode VM.
if ! command -v ssh >/dev/null 2>&1 || ! command -v rsync >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y openssh-client rsync
fi

# --- json-diff (large Grafana dashboard JSON PR diffs) -------------------
command -v json-diff >/dev/null 2>&1 || npm install -g json-diff >/dev/null 2>&1 || true

# --- pmm-framework's Python/Ansible deps (unchanged qa-integration tree) --
cd "$QA_ROOT/qa-integration/pmm_qa"
if [ ! -d virtenv ]; then
  python3 -m venv virtenv
fi
# shellcheck disable=SC1091
. virtenv/bin/activate
pip install --upgrade pip setuptools >/dev/null
pip install -r requirements.txt 'docker>=7.0.0' >/dev/null
deactivate
ansible-galaxy collection install -p "${HOME}/.ansible/collections" community.docker >/dev/null 2>&1 || true

# --- Playwright helper scripts (UI login / screenshots) -------------------
# Browsers are already pre-installed and PLAYWRIGHT_BROWSERS_PATH already
# points at them -- this only needs the `playwright` node module itself.
cd "$QA_ROOT/.claude/scripts"
npm install >/dev/null

chmod +x "$QA_ROOT/qa-integration/pmm_qa/pmm-framework/pmm-framework" \
  "$QA_ROOT"/terraform/linode-runner/*.sh \
  "$QA_ROOT"/.claude/hooks/*.sh 2>/dev/null || true
