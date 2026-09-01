#!/usr/bin/env bash
# down.sh -- destroy the Linode VM for one run. Call this as the LAST step
# of every agent workflow (test-runner, investigator, fb-reporter),
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
ALLOWED_INBOUND_CIDR="${ALLOWED_INBOUND_CIDR:-0.0.0.0/0}"

RUN_TAG=""
if [ -f "$STATE" ]; then
  terraform -chdir="$MODULE_DIR" init -input=false -upgrade=false >/dev/null
  # Capture the run tag before destroy removes it from state.
  RUN_TAG="$(terraform -chdir="$MODULE_DIR" output -state="$STATE" -raw run_tag 2>/dev/null || true)"
  terraform -chdir="$MODULE_DIR" destroy -auto-approve -input=false \
    -state="$STATE" \
    -var "role=$ROLE" \
    -var "run_id=$RUN_ID" \
    -var "allowed_inbound_cidr=$ALLOWED_INBOUND_CIDR"
else
  echo "No state file at $STATE -- nothing for Terraform to destroy (instance may already be gone)." >&2
fi

rm -rf "$RUN_DIR"

# Delete just THIS run's own orphan tag (targeted, O(1)). The instance is gone,
# so its unique pmm-qa-run tag is now an orphan. A full account sweep here would
# risk the relay's 240s teardown timeout; prune-tags.sh stays for the reaper /
# manual use, which aren't timeout-bound.
if [ -n "$RUN_TAG" ]; then
  enc="$(jq -rn --arg t "$RUN_TAG" '$t|@uri')"
  curl -fsS --connect-timeout 10 --max-time 30 -o /dev/null -X DELETE \
    -H "Authorization: Bearer $LINODE_TOKEN" "https://api.linode.com/v4/tags/$enc" \
    || echo "tag delete skipped (non-fatal): $RUN_TAG" >&2
fi

echo "Destroyed run_id=$RUN_ID"
