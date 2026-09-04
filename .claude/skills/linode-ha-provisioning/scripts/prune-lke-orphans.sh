#!/usr/bin/env bash
# prune-lke-orphans.sh -- delete the Block Storage Volumes and NodeBalancers an
# LKE teardown leaves behind. `lke cluster-delete` removes the cluster and its
# nodes but does NOT cascade to the CSI-provisioned volumes or the CCM-provisioned
# NodeBalancer, so they orphan and bill for weeks (the dominant HA cost leak).
#
# Deletion is by PROOF OF NON-USE, not by ownership tags -- so it also reaps
# volumes from provisioning paths that never tag (e.g. an external load-test
# script), which a tag-only rule leaked forever:
#
#   * Volumes: delete a pvc-* volume only when it is (1) unattached, (2) not
#     referenced by ANY live LKE cluster's PVs, and (3) older than a grace window.
#     "Unattached" alone is NOT enough -- a live cluster's volume is unattached
#     during provisioning (Immediate binding) and failover -- so every live
#     cluster's PV names are collected first and used as a keep-set. FAIL-SAFE: if
#     any live cluster's kubeconfig or PV list cannot be read, the whole volume
#     sweep is skipped (delete nothing) rather than risk deleting a live volume we
#     could not verify. The grace window covers the brief race where a volume
#     exists before its PV registers.
#   * NodeBalancers: attributed by their immutable lke<clusterid>- label, deleted
#     only when the cluster is gone AND no backend node is up (see the loop).
#
# Requires the token to carry Volumes, NodeBalancers and Kubernetes(LKE) R/W, and
# `kubectl`, `linode-cli`, `jq`, `curl` on PATH (the volume cross-reference reads
# each live cluster). Without kubectl/linode-cli the volume sweep is skipped.
#
#   LINODE_TOKEN=... prune-lke-orphans.sh            # delete orphans
#   LINODE_TOKEN=... prune-lke-orphans.sh --dry-run  # list them, delete nothing
#   PRUNE_GRACE_MIN=60  (default) -- never touch a volume younger than this
set -euo pipefail
: "${LINODE_TOKEN:?LINODE_TOKEN must be set}"
export LINODE_CLI_TOKEN="$LINODE_TOKEN"   # linode-cli lke kubeconfig-view
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

# Collect every live cluster's PV names into a keep-set. FAIL-SAFE: any unreadable
# cluster leaves xref_ok=0, which skips the whole volume sweep below.
livepv=""; xref_ok=1
if command -v kubectl >/dev/null 2>&1 && command -v linode-cli >/dev/null 2>&1; then
  for cid in $live_cluster_ids; do
    [ -n "$cid" ] || continue
    kc="$(linode-cli lke kubeconfig-view "$cid" --json 2>/dev/null | jq -r '.[0].kubeconfig // empty' 2>/dev/null | base64 -d 2>/dev/null || true)"
    if [ -z "$kc" ]; then echo "prune-lke-orphans: cluster $cid kubeconfig unreadable -> volume sweep skipped" >&2; xref_ok=0; break; fi
    kf="$(mktemp)"; printf '%s' "$kc" >"$kf"
    if ! pvs="$(KUBECONFIG="$kf" kubectl get pv -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null)"; then
      rm -f "$kf"; echo "prune-lke-orphans: cluster $cid PV list failed -> volume sweep skipped" >&2; xref_ok=0; break
    fi
    rm -f "$kf"
    livepv+="$pvs"$'\n'
  done
else
  echo "prune-lke-orphans: kubectl/linode-cli not available -> volume sweep skipped" >&2; xref_ok=0
fi

vol=0 nb=0 fail=0
# Volumes: unattached pvc-* older than the grace window and referenced by no live
# cluster. Skipped entirely unless every live cluster was read (fail-safe above).
if [ "$xref_ok" -eq 1 ]; then
  now="$(date +%s)"
  while IFS=$'\t' read -r id label created lid; do
    [ -n "$id" ] || continue
    [ "$lid" = "null" ] || continue                         # attached -> in use, never
    cs="$(date -d "$created" +%s 2>/dev/null || echo 0)"
    [ "$cs" -gt 0 ] && [ $(( (now - cs) / 60 )) -ge "$GRACE_MIN" ] || continue   # too young / unknown age -> keep
    grep -qx "$label" <<<"$livepv" && continue              # a live cluster still holds this PV -> keep
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
  # An orphan has zero backends up once its cluster is gone; a reused NB (label
  # keeps the old cluster id) still serves traffic. If configs are unreadable, keep
  # it -- fail safe.
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
