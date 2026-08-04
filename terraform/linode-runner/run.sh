#!/usr/bin/env bash
# run.sh -- run a command on an already-provisioned runner over SSH.
#
# Usage:
#   terraform/linode-runner/run.sh <run_id> -- <remote command...>
#
# Examples:
#   run.sh PMM-15196 -- 'docker network create pmm-qa'
#   run.sh PMM-15196 -- 'cd qa-integration/pmm_qa/pmm-framework && ./pmm-framework --database ps=8.4'
set -euo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_ID="${1:?usage: run.sh <run_id> -- <remote command...>}"
shift
if [ "${1:-}" = "--" ]; then
  shift
fi
[ "$#" -gt 0 ] || {
  echo "usage: run.sh <run_id> -- <remote command...>" >&2
  exit 1
}

RUN_DIR="$MODULE_DIR/runs/$RUN_ID"
[ -f "$RUN_DIR/ip" ] || {
  echo "No such run_id '$RUN_ID' (expected $RUN_DIR/ip) -- run up.sh first." >&2
  exit 1
}
IP=$(cat "$RUN_DIR/ip")
KEY=$(cat "$RUN_DIR/ssh_key_path")

exec ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i "$KEY" \
  "root@$IP" "$@"
