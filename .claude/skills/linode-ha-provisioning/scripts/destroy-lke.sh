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
