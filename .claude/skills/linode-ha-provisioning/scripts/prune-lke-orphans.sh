#!/usr/bin/env bash
# prune-lke-orphans.sh -- delete the Block Storage Volumes and NodeBalancers an
# LKE teardown leaves behind. `lke cluster-delete` removes the cluster and its
# nodes but does NOT cascade to the CSI-provisioned volumes or the CCM-provisioned
# NodeBalancer, so they orphan and bill for weeks (the dominant HA cost leak).
#
# Deletion is by PROOF OF NON-USE:
#   * Volumes: delete a pvc-* volume only when it is (1) unattached, (2) older than
#     a grace window, and (3) held by NO live LKE cluster. "Unattached" alone is
#     not enough -- a live cluster's volume is unattached during provisioning
#     (Immediate binding) and failover -- so every live cluster's volumes are
#     collected first (keyed by Linode volume ID, exact) as a keep-set. FAIL-SAFE:
#     if any live cluster cannot be read, the whole volume sweep is skipped rather
#     than risk deleting a live volume. The grace window covers the brief race
#     where a Linode volume exists before its PV registers.
#   * NodeBalancers: attributed by their immutable lke<clusterid>- label, deleted
#     only when the cluster is gone AND no backend node is up (see the loop).
#
# Requires the token to carry Volumes, NodeBalancers and Kubernetes(LKE) R/W, and
# `kubectl`, `jq`, `curl` on PATH (the volume cross-reference reads each live
# cluster over the LKE API). Without kubectl the volume sweep is skipped.
#
#   LINODE_TOKEN=... prune-lke-orphans.sh            # delete orphans
#   LINODE_TOKEN=... prune-lke-orphans.sh --dry-run  # list them, delete nothing
#   PRUNE_GRACE_MIN=60  (default) -- never touch a volume younger than this
set -euo pipefail
: "${LINODE_TOKEN:?LINODE_TOKEN must be set}"
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1
GRACE_MIN="${PRUNE_GRACE_MIN:-60}"

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
live_cluster_ids="$(printf '%s' "$clusters" | jq -r '.id' | sort -u)"

# Keep-set of every live cluster's volumes, keyed by Linode volume ID. The linodebs
# CSI driver caps a volume LABEL at 32 chars, so a label is a truncated form of the
# 40-char PV name and must NOT be string-matched; the PV carries the true id in
# spec.csi.volumeHandle ("<id>-<label>"). PV names are kept too as a secondary
# signal (union only ever keeps more). Kubeconfig is read over the LKE API (no
# linode-cli). FAIL-SAFE: any unreadable cluster leaves xref_ok=0 -> volume sweep
# skipped below.
liveids=""; livepv=""; xref_ok=1
if command -v kubectl >/dev/null 2>&1; then
  for cid in $live_cluster_ids; do
    [ -n "$cid" ] || continue
    kc="$("${CURL[@]}" "$BASE/lke/clusters/$cid/kubeconfig" 2>/dev/null | jq -r '.kubeconfig // empty' 2>/dev/null | base64 -d 2>/dev/null || true)"
    if [ -z "$kc" ]; then echo "prune-lke-orphans: cluster $cid kubeconfig unreadable -> volume sweep skipped" >&2; xref_ok=0; break; fi
    kf="$(mktemp)"; printf '%s' "$kc" >"$kf"
    if ! pvjson="$(KUBECONFIG="$kf" kubectl get pv -o json 2>/dev/null)"; then
      rm -f "$kf"; echo "prune-lke-orphans: cluster $cid PV list failed -> volume sweep skipped" >&2; xref_ok=0; break
    fi
    rm -f "$kf"
    liveids+="$(printf '%s' "$pvjson" | jq -r '.items[]?.spec.csi.volumeHandle // empty' | sed -n 's/^\([0-9]\{1,\}\).*/\1/p')"$'\n'
    livepv+="$(printf '%s' "$pvjson" | jq -r '.items[]?.metadata.name // empty')"$'\n'
  done
else
  echo "prune-lke-orphans: kubectl not available -> volume sweep skipped" >&2; xref_ok=0
fi

vol=0 nb=0 fail=0
if [ "$xref_ok" -eq 1 ]; then
  now="$(date -u +%s)"
  while IFS=$'\t' read -r id label created lid; do
    [ -n "$id" ] || continue
    [ "$lid" = "null" ] || continue                         # attached -> in use, never
    # Linode returns `created` zoneless; read it as UTC so the grace window can't
    # shrink on a relay whose local TZ is east of UTC.
    cs="$(date -u -d "${created}Z" +%s 2>/dev/null || echo 0)"
    [ "$cs" -gt 0 ] && [ $(( (now - cs) / 60 )) -ge "$GRACE_MIN" ] || continue   # too young / unknown age -> keep
    grep -qx "$id" <<<"$liveids" && continue                # a live cluster holds this volume (by id) -> keep
    grep -qx "$label" <<<"$livepv" && continue              # ... or by PV name (belt-and-suspenders) -> keep
    if [ "$DRY" -eq 1 ]; then echo "would delete volume $id ($label) [no live cluster refs it]"; vol=$((vol + 1)); continue; fi
    if "${CURL[@]}" -o /dev/null -X DELETE "$BASE/volumes/$id"; then
      echo "deleted volume $id ($label)"; vol=$((vol + 1))
    else echo "FAILED volume $id ($label)" >&2; fail=$((fail + 1)); fi
  done < <(pages /volumes | jq -r 'select(.label|startswith("pvc-")) | [.id, .label, .created, (.linode_id|tostring)] | @tsv')
fi

# NodeBalancers: the CCM strips custom tags, so attribute by the immutable
# lke<clusterid>- label instead. Delete one only when its cluster is no longer
# live AND no backend node is up -- the idle check guards against an NB adopted
# and reused by another live cluster, which keeps the original cluster's id in
# its label.
while IFS=$'\t' read -r id label; do
  [ -n "$id" ] || continue
  cid="$(sed -n 's/^lke\([0-9]\{1,\}\)-.*/\1/p' <<<"$label")"
  [ -n "$cid" ] || continue                       # not an LKE NodeBalancer -> never ours
  grep -qx "$cid" <<<"$live_cluster_ids" && continue   # its cluster is still live -> keep
  cfg="$("${CURL[@]}" "$BASE/nodebalancers/$id/configs?page_size=100" 2>/dev/null)" \
    || { echo "keeping nodebalancer $id ($label): configs unreadable" >&2; continue; }
  up="$(printf '%s' "$cfg" | jq '[.data[]?.nodes_status.up // 0] | add // 0')"
  [ "${up:-0}" -eq 0 ] || { echo "keeping nodebalancer $id ($label): $up backend(s) up (in use)" >&2; continue; }
  if [ "$DRY" -eq 1 ]; then echo "would delete nodebalancer $id ($label) [cluster $cid gone, idle]"; nb=$((nb + 1)); continue; fi
  if "${CURL[@]}" -o /dev/null -X DELETE "$BASE/nodebalancers/$id"; then
    echo "deleted nodebalancer $id ($label) [cluster $cid gone, idle]"; nb=$((nb + 1))
  else echo "FAILED nodebalancer $id ($label)" >&2; fail=$((fail + 1)); fi
done < <(pages /nodebalancers | jq -r '[.id, .label] | @tsv')

echo "prune-lke-orphans: volumes=$vol nodebalancers=$nb failed=$fail$([ "$DRY" -eq 1 ] && echo ' (dry-run)')$([ "$xref_ok" -eq 1 ] || echo ' (volume sweep skipped: a live cluster was unreadable)')"
[ "$fail" -eq 0 ]
