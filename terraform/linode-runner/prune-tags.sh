#!/usr/bin/env bash
# prune-tags.sh -- delete orphaned Linode account tags left behind by torn-down
# runs. Linode tags are account-level objects: creating an instance/cluster with
# a tag auto-creates the tag, but destroying it leaves the tag behind forever.
# Every run would otherwise leak its unique run tag (pmm-qa-run:<id>-<rand>,
# expires-<epoch>). This deletes only tags attached to NOTHING -- live instances
# and clusters keep theirs, so the VM self-destruct timer and the LKE reaper
# (which both find their target by tag) are never disturbed.
#
# Called best-effort at the end of down.sh / destroy-lke.sh, and runnable by hand.
#
# Usage:
#   LINODE_TOKEN=... prune-tags.sh            # delete our orphan tags (pmm-qa*/expires-*)
#   LINODE_TOKEN=... prune-tags.sh --dry-run  # list what would be deleted, delete nothing
#   LINODE_TOKEN=... prune-tags.sh --all      # also delete orphan tags that don't match our
#                                             # prefixes (legacy bare run_ids like "nightly")
set -euo pipefail

: "${LINODE_TOKEN:?LINODE_TOKEN must be set}"

DRY_RUN=0
MATCH_ALL=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    --all)     MATCH_ALL=1 ;;
    *) echo "unknown arg: $a" >&2; exit 2 ;;
  esac
done

api() {
  curl -fsS -H "Authorization: Bearer $LINODE_TOKEN" "https://api.linode.com/v4$1"
}

# Tags currently attached to a live instance or LKE cluster -- never touch these.
attached="$(
  {
    api "/linode/instances?page_size=500" | jq -r '.data[].tags[]?'
    api "/lke/clusters?page_size=500"     | jq -r '.data[].tags[]?'
  } | sort -u
)"

# All account tags (paginated).
all="$(
  page=1; pages=1
  while :; do
    resp="$(api "/tags?page=${page}&page_size=500")"
    printf '%s\n' "$resp" | jq -r '.data[].label'
    pages="$(printf '%s\n' "$resp" | jq -r '.pages')"
    [ "$page" -ge "$pages" ] && break
    page=$((page + 1))
  done | sort -u
)"

orphans="$(comm -23 <(printf '%s\n' "$all") <(printf '%s\n' "$attached"))"

deleted=0 skipped=0
while IFS= read -r t; do
  [ -n "$t" ] || continue
  if [ "$MATCH_ALL" -eq 0 ] && ! [[ "$t" =~ ^(pmm-qa|expires-) ]]; then
    skipped=$((skipped + 1)); continue
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    echo "would delete: $t"; deleted=$((deleted + 1)); continue
  fi
  enc="$(jq -rn --arg t "$t" '$t|@uri')"
  if curl -fsS -o /dev/null -X DELETE \
      -H "Authorization: Bearer $LINODE_TOKEN" \
      "https://api.linode.com/v4/tags/$enc"; then
    echo "deleted: $t"; deleted=$((deleted + 1))
  else
    echo "failed to delete: $t" >&2
  fi
done <<< "$orphans"

echo "prune-tags: ${deleted} orphan tag(s) $([ "$DRY_RUN" -eq 1 ] && echo 'would be removed' || echo removed), ${skipped} non-matching orphan(s) left (use --all to include them)."
