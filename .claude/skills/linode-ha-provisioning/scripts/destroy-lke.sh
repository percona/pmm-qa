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

echo "[pmm-ha] Deleting LKE cluster $CLUSTER_ID"
linode-cli lke cluster-delete "$CLUSTER_ID"
echo "[pmm-ha] Deleted."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# The orphaned CSI volumes and NodeBalancer this cluster leaves behind are swept
# by the relay reaper (prune-lke-orphans.sh on a timer), not here: cluster-delete
# is async, so a sweep now would still see this cluster's nodes attached and the
# cluster itself listed -- it could only act on OTHER runs' resources.

# Sweep the cluster's orphan tags (best-effort).
PRUNE="$SCRIPT_DIR/../../../../terraform/linode-runner/prune-tags.sh"
if [ -x "$PRUNE" ]; then
  LINODE_TOKEN="$LINODE_TOKEN" "$PRUNE" || echo "[pmm-ha] tag prune skipped (non-fatal)" >&2
else
  echo "[pmm-ha] prune-tags.sh not found at $PRUNE (tags not swept)" >&2
fi
