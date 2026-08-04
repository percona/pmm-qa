#!/usr/bin/env bash
# reap.sh -- safety-net cleanup, independent of any run's local Terraform
# state. Talks to the Linode API directly: lists every instance tagged
# pmm-qa-ephemeral and deletes any whose age has passed its OWN
# pmm-qa-ttl-hours:<N> tag (set at creation time by terraform/linode-runner,
# default 4h). Normal cleanup is down.sh at the end of each agent workflow --
# this only catches runs nobody ever called that on (crashed session,
# abandoned chat, etc).
#
# Deliberately conservative: it only ever touches an instance that has
# already outlived the lifetime it declared for itself. A run still legitimately
# in progress has not reached its own TTL and is left alone.
#
# Usage:
#   LINODE_TOKEN=... terraform/linode-runner/reap.sh [--dry-run]
set -euo pipefail

: "${LINODE_TOKEN:?LINODE_TOKEN must be set}"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

api_get() {
  curl -fsS -H "Authorization: Bearer $LINODE_TOKEN" "https://api.linode.com/v4$1"
}

now_epoch=$(date -u +%s)
reaped=0
kept=0

instances=$(api_get "/linode/instances?tags=pmm-qa-ephemeral&page_size=100" | jq -c '.data[]')

if [ -z "$instances" ]; then
  echo "No pmm-qa-ephemeral instances found."
  exit 0
fi

while IFS= read -r inst; do
  id=$(jq -r '.id' <<<"$inst")
  label=$(jq -r '.label' <<<"$inst")
  created=$(jq -r '.created' <<<"$inst")
  tags=$(jq -r '.tags | join(",")' <<<"$inst")

  ttl_hours=$(grep -oE 'pmm-qa-ttl-hours:[0-9]+' <<<"$tags" | cut -d: -f2 || true)
  ttl_hours="${ttl_hours:-4}"

  created_epoch=$(date -u -d "$created" +%s)
  age_hours=$(((now_epoch - created_epoch) / 3600))

  if ((age_hours >= ttl_hours)); then
    echo "REAP: id=$id label=$label age=${age_hours}h ttl=${ttl_hours}h tags=[$tags]"
    reaped=$((reaped + 1))
    if [ "$DRY_RUN" -eq 0 ]; then
      curl -fsS -X DELETE -H "Authorization: Bearer $LINODE_TOKEN" \
        "https://api.linode.com/v4/linode/instances/$id" >/dev/null
    fi
  else
    echo "KEEP: id=$id label=$label age=${age_hours}h ttl=${ttl_hours}h (not past its own TTL yet)"
    kept=$((kept + 1))
  fi
done <<<"$instances"

echo
if [ "$DRY_RUN" -eq 1 ]; then
  echo "Dry run: would reap $reaped, keeping $kept."
else
  echo "Reaped $reaped, kept $kept."
fi
