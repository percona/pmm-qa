#!/usr/bin/env bash
# down.sh -- destroy the Linode VM for one run. Call this as the LAST step
# of every agent workflow (test-runner, test-doctor, investigator, fb-reporter),
# on every exit path -- success, failure, or blocked. This is the primary
# cleanup mechanism; the on-box self-destruct timer (cloud-init.yaml.tftpl)
# is only the safety net for runs nobody ever called this on.
#
# Usage:
#   LINODE_TOKEN=... terraform/linode-runner/down.sh <run_id>
set -euo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_ID="${1:?usage: down.sh <run_id>}"
case "$RUN_ID" in
  ''|.|..|*/*)
    echo "invalid run_id '$RUN_ID' -- must be a single path component (no '/', not '.' or '..')" >&2
    exit 1
    ;;
esac
if ! [[ "$RUN_ID" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "invalid run_id '$RUN_ID' -- letters, digits, '.', '_', '-' only" >&2
  exit 1
fi
RUN_DIR="$MODULE_DIR/runs/$RUN_ID"

if [ ! -d "$RUN_DIR" ]; then
  echo "No run directory for '$RUN_ID' -- nothing to destroy." >&2
  exit 0
fi

: "${LINODE_TOKEN:?LINODE_TOKEN must be set}"

export TF_DATA_DIR="$RUN_DIR/.terraform"
export TF_PLUGIN_CACHE_DIR="$MODULE_DIR/.plugin-cache"
export TF_VAR_linode_token="$LINODE_TOKEN"
STATE="$RUN_DIR/terraform.tfstate"
ROLE=$(cat "$RUN_DIR/role" 2>/dev/null || echo unknown)

if [ -f "$STATE" ]; then
  terraform -chdir="$MODULE_DIR" destroy -auto-approve -input=false \
    -state="$STATE" \
    -var "role=$ROLE" \
    -var "run_id=$RUN_ID"
else
  echo "No state file at $STATE -- nothing for Terraform to destroy (instance may already be gone)." >&2
fi

rm -rf "$RUN_DIR"
echo "Destroyed run_id=$RUN_ID"
