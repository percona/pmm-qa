#!/usr/bin/env bash
# SessionEnd hook -- best-effort teardown, not the guarantee (SessionEnd
# doesn't reliably fire on an abandoned session); the on-box self-destruct
# timer (cloud-init.yaml.tftpl) is what actually guarantees cleanup.
set -euo pipefail

if [ -z "${LINODE_TOKEN:-}" ]; then
  exit 0
fi

# Without our own session ID we can't tell our runs apart from a concurrent session's -- skip rather than risk tearing down someone else's active VM.
if [ -z "${CLAUDE_CODE_SESSION_ID:-}" ]; then
  exit 0
fi

QA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNNER_DIR="$QA_ROOT/terraform/linode-runner"
RUNS_DIR="$RUNNER_DIR/runs"

[ -d "$RUNS_DIR" ] || exit 0

shopt -s nullglob
for run_dir in "$RUNS_DIR"/*/; do
  run_id=$(basename "$run_dir")
  [ -f "$run_dir/terraform.tfstate" ] || continue
  # up.sh tags each run with its session -- only tear down our own.
  [ -f "$run_dir/session_id" ] || continue
  [ "$(cat "$run_dir/session_id")" = "$CLAUDE_CODE_SESSION_ID" ] || continue
  timeout 90 "$RUNNER_DIR/down.sh" "$run_id" >>"$run_dir/session-end-cleanup.log" 2>&1 || true
done
