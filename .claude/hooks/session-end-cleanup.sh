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

RUNNER_DIR="$CLAUDE_PROJECT_DIR/terraform/linode-runner"
RUNS_DIR="$RUNNER_DIR/runs"

# Scanning every run dir here (not just one this hook remembers starting) is
# safe: each Claude Code cloud session gets its own isolated VM/working tree,
# so runs/ never holds another session's in-flight state to collide with.
[ -d "$RUNS_DIR" ] || exit 0

shopt -s nullglob
for run_dir in "$RUNS_DIR"/*/; do
  run_id=$(basename "$run_dir")
  [ -f "$run_dir/terraform.tfstate" ] || continue
  timeout 90 "$RUNNER_DIR/down.sh" "$run_id" >>"$run_dir/session-end-cleanup.log" 2>&1 || true
done
