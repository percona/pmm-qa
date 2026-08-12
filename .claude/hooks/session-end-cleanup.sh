#!/usr/bin/env bash
# SessionEnd hook -- best-effort teardown of this session's runner VMs.
# Not the guarantee (SessionEnd doesn't reliably fire on an abandoned
# session); the on-box self-destruct timer (cloud-init.yaml.tftpl) is what
# actually guarantees cleanup. Two provisioning paths, torn down two ways:
#   * relay-brokered (runs/<id>/relay present): POST /linode/destroy to the relay
#     with RELAY_KEY -- the LINODE_TOKEN lives only on the relay, never here.
#   * legacy local state (terraform.tfstate + LINODE_TOKEN in env): down.sh.
# A run carrying a keep-alive marker is left up on purpose (an explicit
# "leave it running" request); its self-destruct timer still reaps it.
set -euo pipefail

# Without our own session ID we can't tell our runs apart from a concurrent
# session's -- skip rather than risk tearing down someone else's active VM.
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
  # Each run is tagged with the session that provisioned it -- only tear down our own.
  [ -f "$run_dir/session_id" ] || continue
  [ "$(cat "$run_dir/session_id")" = "$CLAUDE_CODE_SESSION_ID" ] || continue
  # An explicit keep-alive request leaves the VM up; the on-box timer still reaps it.
  [ -f "$run_dir/keep-alive" ] && continue

  log="$run_dir/session-end-cleanup.log"
  if [ -f "$run_dir/relay" ]; then
    # Relay-brokered: the token lives on the relay; ask it to destroy.
    # The marker file holds the relay base URL (RELAY_BASE_URL overrides it).
    # Identity: the relay verifies X-GitHub-Token against GitHub.
    [ -n "${RELAY_KEY:-}" ] || continue
    base="${RELAY_BASE_URL:-$(cat "$run_dir/relay" 2>/dev/null)}"
    [ -n "$base" ] || continue
    gh_tok="${GH_TOKEN:-$(gh auth token 2>/dev/null || true)}"
    curl -sS -m 120 -X POST "$base/linode/destroy" \
      -H "X-Relay-Secret: $RELAY_KEY" \
      -H "X-GitHub-Token: $gh_tok" \
      -H "Content-Type: application/json" \
      -d "{\"run_id\":\"$run_id\"}" \
      >>"$log" 2>&1 || true
  elif [ -f "$run_dir/terraform.tfstate" ] && [ -n "${LINODE_TOKEN:-}" ]; then
    # Legacy local-state path (LINODE_TOKEN still in this env).
    timeout 90 "$RUNNER_DIR/down.sh" "$run_id" >>"$log" 2>&1 || true
  fi
done
