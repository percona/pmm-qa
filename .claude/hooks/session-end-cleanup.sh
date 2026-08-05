#!/usr/bin/env bash
# SessionEnd hook -- best-effort teardown of any Linode VM this session
# provisioned and never called down.sh on.
#
# NOT the guarantee: SessionEnd does not reliably fire on an abandoned /
# timed-out remote session, and even when it does fire, async work here can
# be killed before finishing. It only helps on a clean, graceful session
# end. The actual guarantee is each instance's own on-box self-destruct
# timer (see terraform/linode-runner/cloud-init.yaml.tftpl) -- this hook is
# a nice-to-have that shaves time off that window when it does get to run.
set -euo pipefail

if [ -z "${LINODE_TOKEN:-}" ]; then
  exit 0
fi

# Without our own session ID we can't safely tell our runs apart from a
# concurrent session's sharing this same working tree -- skip rather than
# risk tearing down someone else's active VM. The on-box self-destruct timer
# is the real guarantee regardless (see cloud-init.yaml.tftpl).
if [ -z "${CLAUDE_CODE_SESSION_ID:-}" ]; then
  exit 0
fi

RUNNER_DIR="$CLAUDE_PROJECT_DIR/terraform/linode-runner"
RUNS_DIR="$RUNNER_DIR/runs"

[ -d "$RUNS_DIR" ] || exit 0

shopt -s nullglob
for run_dir in "$RUNS_DIR"/*/; do
  run_id=$(basename "$run_dir")
  [ -f "$run_dir/terraform.tfstate" ] || continue
  # up.sh tags each run with the session that provisioned it -- only tear
  # down our own; an untagged or differently-tagged run is left alone.
  [ -f "$run_dir/session_id" ] || continue
  [ "$(cat "$run_dir/session_id")" = "$CLAUDE_CODE_SESSION_ID" ] || continue
  timeout 90 "$RUNNER_DIR/down.sh" "$run_id" >>"$run_dir/session-end-cleanup.log" 2>&1 || true
done
