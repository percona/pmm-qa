#!/usr/bin/env bash
# prune-lke-orphans.sh -- delete the Block Storage Volumes and NodeBalancers an
# LKE teardown leaves behind. `lke cluster-delete` removes the cluster and its
# nodes, but the CSI-provisioned volumes (pvc-*) and the CCM-provisioned
# NodeBalancer are NOT cascaded: the in-cluster controllers that would delete
# them die with the cluster, and Linode never removes them, so they orphan and
# bill for weeks. This sweeps them, ORPHAN-ONLY -- nothing live is ever touched:
#   * Volumes attached to no Linode (linode_id null) whose label is pvc-*
#     (dynamically provisioned by the CSI driver -- ephemeral test data).
#   * NodeBalancers named lke<clusterid>-* whose cluster no longer exists.
# An attached volume, a non-pvc volume, or an NB of a live cluster is left alone.
#
# Requires the token to carry Volumes and NodeBalancers Read/Write (and LKE Read)
# in addition to LKE Read/Write. API-only (curl+jq); no cluster access needed.
#
#   LINODE_TOKEN=... prune-lke-orphans.sh            # delete orphans
#   LINODE_TOKEN=... prune-lke-orphans.sh --dry-run  # list them, delete nothing
set -euo pipefail
: "${LINODE_TOKEN:?LINODE_TOKEN must be set}"
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1

BASE="https://api.linode.com/v4"
CURL=(curl -fsS --connect-timeout 10 --max-time 30 -H "Authorization: Bearer $LINODE_TOKEN")

pages() {  # $1 = path (may contain ?query); prints each .data[] as compact JSON
  local p=$1 page=1 tot=1 sep resp
  case "$p" in *\?*) sep="&";; *) sep="?";; esac
  while :; do
    resp="$("${CURL[@]}" "$BASE$p${sep}page=$page&page_size=500")"
    printf '%s' "$resp" | jq -c '.data[]'
    tot="$(printf '%s' "$resp" | jq -r '.pages')"
    [ "$page" -ge "$tot" ] && break
    page=$((page + 1))
  done
}

live="$(pages /lke/clusters | jq -r '.id' | sort -u)"

vol=0 nb=0 fail=0
# Orphaned CSI volumes: unattached AND named pvc-*
while IFS=$'\t' read -r id label lid; do
  [ -n "$id" ] || continue
  [ "$lid" = "null" ] || continue
  case "$label" in pvc-*) : ;; *) continue ;; esac
  if [ "$DRY" -eq 1 ]; then echo "would delete volume $id ($label)"; vol=$((vol + 1)); continue; fi
  if "${CURL[@]}" -o /dev/null -X DELETE "$BASE/volumes/$id"; then
    echo "deleted volume $id ($label)"; vol=$((vol + 1))
  else echo "FAILED volume $id ($label)" >&2; fail=$((fail + 1)); fi
done < <(pages /volumes | jq -r '[.id,.label,(.linode_id|tostring)]|@tsv')

# Orphaned NodeBalancers: lke<clusterid>-* whose cluster is gone
while IFS=$'\t' read -r id label; do
  [ -n "$id" ] || continue
  cid="$(printf '%s' "$label" | sed -n 's/^lke\([0-9]\{1,\}\)-.*/\1/p')"
  [ -n "$cid" ] || continue
  grep -qx "$cid" <<<"$live" && continue
  if [ "$DRY" -eq 1 ]; then echo "would delete nodebalancer $id ($label)"; nb=$((nb + 1)); continue; fi
  if "${CURL[@]}" -o /dev/null -X DELETE "$BASE/nodebalancers/$id"; then
    echo "deleted nodebalancer $id ($label)"; nb=$((nb + 1))
  else echo "FAILED nodebalancer $id ($label)" >&2; fail=$((fail + 1)); fi
done < <(pages /nodebalancers | jq -r '[.id,.label]|@tsv')

echo "prune-lke-orphans: volumes=$vol nodebalancers=$nb failed=$fail$([ "$DRY" -eq 1 ] && echo ' (dry-run)')"
[ "$fail" -eq 0 ]
