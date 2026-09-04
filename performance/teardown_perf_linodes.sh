#!/usr/bin/env bash
# Delete the load-test client VMs that linode_stackScript_load_pmm3.sh creates.
# Those instances bill until removed, so this is the teardown the create step
# needs. It deletes ONLY instances carrying the pmm-qa-ephemeral tag the create
# step stamps -- never anything else. --dry-run lists them and deletes nothing.
#
#   ./teardown_perf_linodes.sh --dry-run    # preview
#   ./teardown_perf_linodes.sh              # delete
#   PMM_PERF_TAG=pmm-qa-perf-run:20260904-120000 ./teardown_perf_linodes.sh  # one batch
set -Eeuo pipefail

DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1
TAG="${PMM_PERF_TAG:-pmm-qa-ephemeral}"
command -v linode-cli >/dev/null || { echo "linode-cli is required" >&2; exit 1; }

# List every instance once (linode-cli failure aborts via set -e), then match the
# tag client-side so this never depends on a server-side tag-filter flag.
raw="$(linode-cli linodes list --format 'id,label,tags' --text --no-headers --delimiter $'\t')"

n=0 fail=0
while IFS=$'\t' read -r id label tags; do
  [ -n "$id" ] || continue
  printf '%s' "$tags" | grep -qw -- "$TAG" || continue
  if [ "$DRY" -eq 1 ]; then echo "would delete linode $id ($label)"; n=$((n + 1)); continue; fi
  if linode-cli linodes delete "$id"; then
    echo "deleted linode $id ($label)"; n=$((n + 1))
  else
    echo "FAILED linode $id ($label)" >&2; fail=$((fail + 1))
  fi
done <<< "$raw"

echo "teardown_perf_linodes: instances=$n failed=$fail$([ "$DRY" -eq 1 ] && echo ' (dry-run)') [tag=$TAG]"
[ "$fail" -eq 0 ]
