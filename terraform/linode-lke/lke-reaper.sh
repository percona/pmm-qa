#!/usr/bin/env bash
# LKE reaper: the backstop for throwaway HA clusters, which have no on-box self-destruct
# timer. Deletes every `pmm-qa-ephemeral` cluster whose `expires-<epoch>` tag is past (or,
# with no parseable tag, created more than LKE_HARD_MAX_TTL_HOURS ago), then sweeps the
# tags and volumes they leave behind. Never touches a cluster without that tag.
# Run it on a timer (the chaos-pmm runner hosts: every 15 minutes).
#   LINODE_TOKEN=... lke-reaper.sh [--dry-run]
set -euo pipefail
: "${LINODE_TOKEN:?LINODE_TOKEN must be set}"
SD=$(cd "$(dirname "$0")" && pwd)
DRY=0; [ "${1:-}" = --dry-run ] && DRY=1
HARD_MAX=$(( ${LKE_HARD_MAX_TTL_HOURS:-48} * 3600 ))
api() { curl -fsS --connect-timeout 10 --max-time 60 -K <(printf 'header = "Authorization: Bearer %s"\n' "$LINODE_TOKEN") "$@"; }
now=$(date +%s); page=1; pages=1; checked=0; reaped=0
while [ "$page" -le "$pages" ]; do
  j=$(api "https://api.linode.com/v4/lke/clusters?page=$page&page_size=100")
  pages=$(jq -r '.pages // 1' <<<"$j")
  while IFS=$'\t' read -r id label expiry; do
    checked=$((checked + 1))
    [ "$now" -gt "$expiry" ] || continue
    if [ "$DRY" = 1 ]; then echo "lke-reaper: would delete $id \"$label\" (expiry $expiry)"; continue; fi
    # cluster-delete doesn't cascade to volumes; tag them first so the orphan sweep finds them.
    LINODE_TOKEN="$LINODE_TOKEN" bash "$SD/tag-lke-resources.sh" "$id" >/dev/null 2>&1 || echo "lke-reaper: volume tag skipped for $id" >&2
    if api -X DELETE "https://api.linode.com/v4/lke/clusters/$id" >/dev/null; then
      echo "lke-reaper: deleted $id \"$label\" (expiry $expiry < $now)"; reaped=$((reaped + 1))
    else echo "lke-reaper: delete failed for $id" >&2; fi
  done < <(jq -r --argjson max "$HARD_MAX" '.data[] | select(.tags | index("pmm-qa-ephemeral"))
      | (([.tags[] | (capture("^expires-(?<e>[0-9]+)$").e? // empty) | tonumber] | first)
        // ((((.created // "") + "Z") | try fromdateiso8601 catch 0) + $max)) as $exp
      | [.id, .label, $exp] | @tsv' <<<"$j")
  page=$((page + 1))
done
[ "$checked" = 0 ] || echo "lke-reaper: checked $checked ephemeral cluster(s), reaped $reaped"
[ "$DRY" = 1 ] && exit 0
[ "$reaped" = 0 ] || bash "$SD/../linode-runner/prune-tags.sh" || echo "lke-reaper: tag prune skipped" >&2
# Every run: a deleted cluster's volumes detach a little later.
bash "$SD/prune-lke-orphans.sh" || echo "lke-reaper: orphan sweep skipped" >&2
