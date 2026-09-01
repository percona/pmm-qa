#!/usr/bin/env bash
# prune-lke-orphans.sh -- delete the Block Storage Volumes and NodeBalancers an
# LKE teardown leaves behind. `lke cluster-delete` removes the cluster and its
# nodes but does NOT cascade to the CSI-provisioned volumes or the CCM-provisioned
# NodeBalancer, so they orphan and bill for weeks (the dominant HA cost leak).
#
# Deletion is by POSITIVE ATTRIBUTION -- a candidate must be provably ours AND
# provably belong to a cluster that no longer exists. "Unattached" is NOT used as
# a proxy for "orphaned": a live cluster's CSI volume is unattached during
# provisioning (Immediate binding) and during failover, and every LKE volume on
# the account is named pvc-*, so an unattached-pvc rule would delete live and
# other-owner data. Instead:
#   * Volumes: create-lke stamps each of its volumes with pmm-qa-run:<id> (the
#     same tag the cluster carries). Delete a volume only when it has a
#     pmm-qa-run:<id> tag whose run has NO live cluster -- so a live cluster's
#     volumes (its run is still listed) and untagged/other-owner volumes are
#     never touched.
#   * NodeBalancers: named lke<clusterid>-*; delete only when that cluster id is
#     no longer in the live cluster list.
# If a volume was never tagged (tagging is best-effort at provision), it is left
# alone -- the failure mode is a leak (recoverable by hand), never a wrong delete.
#
# Requires the token to carry Volumes and NodeBalancers Read/Write (plus LKE Read).
# API-only (curl+jq); no cluster access needed.
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

clusters="$(pages /lke/clusters)"
live_runs="$(printf '%s' "$clusters" | jq -r '.tags[]? | select(startswith("pmm-qa-run:"))' | sort -u)"
live_ids="$(printf '%s' "$clusters"  | jq -r '.id' | sort -u)"

vol=0 nb=0 fail=0
# Volumes: ours (pmm-qa-run:<id> tag) AND run has no live cluster AND unattached.
while IFS=$'\t' read -r id label run lid; do
  [ -n "$id" ] || continue
  [ "$lid" = "null" ] || continue                 # defence-in-depth: never an attached volume
  grep -qx "$run" <<<"$live_runs" && continue     # its cluster is still live -> keep
  if [ "$DRY" -eq 1 ]; then echo "would delete volume $id ($label) [$run]"; vol=$((vol + 1)); continue; fi
  if "${CURL[@]}" -o /dev/null -X DELETE "$BASE/volumes/$id"; then
    echo "deleted volume $id ($label) [$run]"; vol=$((vol + 1))
  else echo "FAILED volume $id ($label)" >&2; fail=$((fail + 1)); fi
done < <(pages /volumes | jq -r '
  . as $v | ($v.tags[]? | select(startswith("pmm-qa-run:"))) as $t
  | [$v.id, $v.label, $t, ($v.linode_id|tostring)] | @tsv')

# NodeBalancers: lke<clusterid>-* whose cluster is gone.
while IFS=$'\t' read -r id label; do
  [ -n "$id" ] || continue
  cid="$(printf '%s' "$label" | sed -n 's/^lke\([0-9]\{1,\}\)-.*/\1/p')"
  [ -n "$cid" ] || continue
  grep -qx "$cid" <<<"$live_ids" && continue
  if [ "$DRY" -eq 1 ]; then echo "would delete nodebalancer $id ($label)"; nb=$((nb + 1)); continue; fi
  if "${CURL[@]}" -o /dev/null -X DELETE "$BASE/nodebalancers/$id"; then
    echo "deleted nodebalancer $id ($label)"; nb=$((nb + 1))
  else echo "FAILED nodebalancer $id ($label)" >&2; fail=$((fail + 1)); fi
done < <(pages /nodebalancers | jq -r '[.id,.label]|@tsv')

echo "prune-lke-orphans: volumes=$vol nodebalancers=$nb failed=$fail$([ "$DRY" -eq 1 ] && echo ' (dry-run)')"
[ "$fail" -eq 0 ]
