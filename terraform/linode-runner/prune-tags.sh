#!/usr/bin/env bash
# prune-tags.sh -- delete orphaned Linode account tags left behind by torn-down
# runs. Linode tags are account-level objects: creating an instance/cluster with
# a tag auto-creates the tag, but destroying it leaves the tag behind. Every run
# would otherwise leak its unique tag (pmm-qa-run:<id>-<rand>, expires-<epoch>).
#
# DELETE /v4/tags/<label> is account-GLOBAL -- it strips the tag off every
# resource still carrying it -- so each candidate is verified orphan against
# GET /v4/tags/<label> (which lists tagged objects of ALL types: instances, LKE
# clusters, volumes, nodebalancers, domains, IPs) immediately before deleting.
# Scope is restricted to the tags this project creates (pmm-qa* / expires-), so a
# shared account's other tags are never touched.
#
# Called best-effort at the end of down.sh / destroy-lke.sh and the LKE reaper,
# and runnable by hand. Exits non-zero if any delete failed.
#
# Usage:
#   LINODE_TOKEN=... prune-tags.sh            # delete our orphan tags
#   LINODE_TOKEN=... prune-tags.sh --dry-run  # list them, delete nothing
set -euo pipefail

: "${LINODE_TOKEN:?LINODE_TOKEN must be set}"

DRY_RUN=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "unknown arg: $a" >&2; exit 2 ;;
  esac
done

BASE="https://api.linode.com/v4"
AUTH=(-H "Authorization: Bearer $LINODE_TOKEN")
# Every call is time-bounded so a stalled request can't hang a teardown.
CURL=(curl -fsS --connect-timeout 10 --max-time 30 "${AUTH[@]}")

# All account tags (paginated), narrowed to the tags this project creates.
mapfile -t candidates < <(
  page=1; pages=1
  while :; do
    resp="$("${CURL[@]}" "$BASE/tags?page=${page}&page_size=500")"
    printf '%s\n' "$resp" | jq -r '.data[].label'
    pages="$(printf '%s\n' "$resp" | jq -r '.pages')"
    [ "$page" -ge "$pages" ] && break
    page=$((page + 1))
  done | { grep -E '^(pmm-qa|expires-)' || true; } | sort -u
)

deleted=0 kept=0 failed=0
for t in "${candidates[@]:-}"; do
  [ -n "$t" ] || continue
  enc="$(jq -rn --arg t "$t" '$t|@uri')"
  # Authoritative check across ALL resource types, right before deleting. A tag
  # that raced back into use (or a transient error) is left alone, not deleted.
  info="$("${CURL[@]}" "$BASE/tags/${enc}?page_size=25" 2>/dev/null || true)"
  [ -n "$info" ] || { kept=$((kept + 1)); continue; }
  n="$(printf '%s' "$info" | jq -r '.results // (.data | length)')"
  [ "$n" = "0" ] || { kept=$((kept + 1)); continue; }

  if [ "$DRY_RUN" -eq 1 ]; then
    echo "would delete: $t"; deleted=$((deleted + 1)); continue
  fi
  if "${CURL[@]}" -o /dev/null -X DELETE "$BASE/tags/${enc}"; then
    echo "deleted: $t"; deleted=$((deleted + 1))
  else
    echo "failed to delete: $t" >&2; failed=$((failed + 1))
  fi
done

echo "prune-tags: ${deleted} orphan tag(s) $([ "$DRY_RUN" -eq 1 ] && echo 'would be removed' || echo removed), ${kept} still attached (kept), ${failed} failed."
[ "$failed" -eq 0 ]
