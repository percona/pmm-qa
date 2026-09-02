#!/bin/bash
# Delete the LKE cluster for a run. Pass a cluster id, or a RUN_ID whose run dir
# holds cluster_id. Mandatory cleanup -- LKE clusters bill by the hour.
#   destroy-lke.sh <cluster_id>
#   RUN_ID=<id> destroy-lke.sh
set -euo pipefail

[ -n "${LINODE_TOKEN:-}" ] || { echo "ERROR: set LINODE_TOKEN (Linode API token, LKE Read/Write)." >&2; exit 1; }
export LINODE_CLI_TOKEN="$LINODE_TOKEN"

CLUSTER_ID="${1:-}"
if [ -z "$CLUSTER_ID" ] && [ -n "${RUN_ID:-}" ]; then
    CLUSTER_ID="$(cat "/tmp/pmm-ha/${RUN_ID}/cluster_id" 2>/dev/null || true)"
fi
[ -n "$CLUSTER_ID" ] || { echo "usage: destroy-lke.sh <cluster_id>  (or set RUN_ID)" >&2; exit 2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Tag the cluster's still-attached volumes BEFORE deleting it, while the nodes
# (and so the volume attachments) still exist. cluster-delete does not cascade to
# these volumes; tagging them now lets prune-lke-orphans.sh attribute and delete
# them once they detach. Covers volumes created after provisioning, which the
# create-lke provision-time pass never saw. Best-effort.
LINODE_TOKEN="$LINODE_TOKEN" bash "$SCRIPT_DIR/tag-lke-resources.sh" "$CLUSTER_ID" \
  || echo "[pmm-ha] volume tagging skipped (non-fatal)" >&2

echo "[pmm-ha] Deleting LKE cluster $CLUSTER_ID"
linode-cli lke cluster-delete "$CLUSTER_ID"
echo "[pmm-ha] Deleted."

# Sweep the cluster's orphan tags (best-effort).
PRUNE="$SCRIPT_DIR/../../../../terraform/linode-runner/prune-tags.sh"
if [ -x "$PRUNE" ]; then
  LINODE_TOKEN="$LINODE_TOKEN" "$PRUNE" || echo "[pmm-ha] tag prune skipped (non-fatal)" >&2
else
  echo "[pmm-ha] prune-tags.sh not found at $PRUNE (tags not swept)" >&2
fi
