#!/usr/bin/env bash
# Tag an LKE cluster's attached Block Storage volumes with its pmm-qa-run:<id> tag
# so prune-lke-orphans.sh can attribute and delete them once the cluster is gone.
# Must run while the cluster's nodes still exist -- cluster-delete does not cascade
# to the volumes, and only an attached volume can be linked back to the cluster
# here (a volume unattached at call time is not tagged). NodeBalancers are not
# tagged: the CCM reconciles their tags away; the sweep attributes them by their
# lke<id> label instead. Best-effort and API-only; never fails its caller.
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

# All volumes as JSONL, across every page -- the account can hold more than one.
vols=""
page=1 total=1
while [ "$page" -le "$total" ]; do
  resp="$("${CURL[@]}" "$BASE/volumes?page=$page&page_size=500" 2>/dev/null || true)"
  [ -n "$resp" ] || break
  vols+="$(printf '%s' "$resp" | jq -c '.data[]')"$'\n'
  total="$(printf '%s' "$resp" | jq -r '.pages // 1')"
  page=$((page + 1))
done

n=0
for lid in $ids; do
  while IFS= read -r vjson; do
    [ -n "$vjson" ] || continue
    vid="$(printf '%s' "$vjson" | jq -r '.id')"
    # Merge our tags with the volume's existing ones (PUT replaces the whole list),
    # so unrelated tags are preserved.
    tags="$(printf '%s' "$vjson" | jq -c --arg r "pmm-qa-run:$RUN" '((.tags // []) + ["pmm-qa-ephemeral", $r]) | unique')"
    "${CURL[@]}" -o /dev/null -X PUT -H "Content-Type: application/json" -d "{\"tags\":$tags}" \
      "$BASE/volumes/$vid" && n=$((n + 1)) || echo "tag-lke-resources: tag failed for volume $vid (non-fatal)" >&2
  done < <(printf '%s\n' "$vols" | jq -c --argjson l "$lid" 'select(.linode_id==$l)')
done
echo "tag-lke-resources: cluster $CID run=$RUN tagged $n volume(s)"
