#!/usr/bin/env bash
# Tag an LKE cluster's currently-attached Block Storage volumes with its
# pmm-qa-run:<id> tag, so prune-lke-orphans.sh can attribute and delete them once
# the cluster (and its in-cluster CSI controller) is gone.
#
# Called on three paths so every volume that exists at the cluster's death is
# tagged, not just the ones present when provisioning finished:
#   * create-lke-pmm-ha.sh EXIT trap  -- at provision (covers failed bring-ups)
#   * destroy-lke.sh                  -- right before an explicit cluster-delete
#   * the relay reaper                -- right before a TTL cluster-delete
# The last two matter because a cluster grows PVCs after provisioning (a scaled
# StatefulSet, a backup), and those later volumes are never seen by the
# provision-time pass.
#
# NodeBalancers are deliberately NOT tagged here: the Linode CCM reconciles a
# NodeBalancer's tags back to its defaults, so a custom tag does not survive.
# prune-lke-orphans.sh attributes NodeBalancers by their immutable lke<id> label
# instead.
#
# Best-effort and API-only (curl+jq); never fails its caller.
#   LINODE_TOKEN=... tag-lke-resources.sh <cluster_id> [run_id]
set -euo pipefail
: "${LINODE_TOKEN:?LINODE_TOKEN must be set}"
CID="${1:?usage: tag-lke-resources.sh <cluster_id> [run_id]}"
RUN="${2:-}"

BASE="https://api.linode.com/v4"
CURL=(curl -fsS --connect-timeout 10 --max-time 30 -H "Authorization: Bearer $LINODE_TOKEN")

# Resolve the run id from the cluster's own pmm-qa-run tag (or its label) when the
# caller did not pass one -- destroy-lke / the reaper only know the cluster id.
if [ -z "$RUN" ]; then
  cluster="$("${CURL[@]}" "$BASE/lke/clusters/$CID" 2>/dev/null || true)"
  RUN="$(printf '%s' "$cluster" | jq -r '.tags[]? | select(startswith("pmm-qa-run:")) | sub("^pmm-qa-run:";"")' 2>/dev/null | head -1)"
  [ -n "$RUN" ] || RUN="$(printf '%s' "$cluster" | jq -r '.label // empty' 2>/dev/null | sed 's/^pmm-ha-//')"
fi
[ -n "$RUN" ] || { echo "tag-lke-resources: could not resolve a run id for cluster $CID (skipping)" >&2; exit 0; }

ids="$("${CURL[@]}" "$BASE/lke/clusters/$CID/pools?page_size=500" 2>/dev/null \
        | jq -r '.data[].nodes[].instance_id' 2>/dev/null | grep -vx null || true)"
vols="$("${CURL[@]}" "$BASE/volumes?page_size=500" 2>/dev/null || true)"
payload="$(jq -cn --arg r "pmm-qa-run:$RUN" '{tags:["pmm-qa-ephemeral",$r]}')"

n=0
for lid in $ids; do
  for vid in $(printf '%s' "$vols" | jq -r --argjson l "$lid" '.data[] | select(.linode_id==$l) | .id' 2>/dev/null); do
    "${CURL[@]}" -o /dev/null -X PUT -H "Content-Type: application/json" -d "$payload" \
      "$BASE/volumes/$vid" && n=$((n + 1)) || echo "tag-lke-resources: tag failed for volume $vid (non-fatal)" >&2
  done
done
echo "tag-lke-resources: cluster $CID run=$RUN tagged $n volume(s)"
