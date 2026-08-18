#!/usr/bin/env bash
# sync.sh -- update the already-cloned /root/pmm-qa on a live instance to a
# different (or just newer) ref, without recreating the VM.
#
# Whatever ref you pass MUST already be pushed to percona/pmm-qa -- this
# only ever fetches from GitHub. Claude never edits code directly on the
# box; if a fix needs testing, commit and push it from this environment
# first, then sync.sh (or a fresh up.sh) to pull it onto the runner.
#
# Usage:
#   terraform/linode-runner/sync.sh <run_id> [ref]   # ref defaults to main
set -euo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_ID="${1:?usage: sync.sh <run_id> [ref]}"
REF="${2:-main}"

"$MODULE_DIR/run.sh" "$RUN_ID" -- "
  cd /root/pmm-qa &&
  git fetch --depth 1 origin '$REF' &&
  git checkout -B '$REF' FETCH_HEAD &&
  git log -1 --oneline
"
