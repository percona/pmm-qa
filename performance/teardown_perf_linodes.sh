#!/usr/bin/env bash
# Delete the load-test client VMs from linode_stackScript_load_pmm3.sh. Defaults to
# this harness's pmm-qa-perf tag, never the account-wide pmm-qa-ephemeral (the
# Terraform QA runner and LKE clusters carry that too, and linode-cli lists
# account-wide). See README.md for usage.
set -Eeuo pipefail

DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1
TAG="${PMM_PERF_TAG:-pmm-qa-perf}"
command -v linode-cli >/dev/null || { echo "linode-cli is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

# index() matches the tag as an exact array element, so pmm-qa-perf can't also
# catch pmm-qa-perf-run:<id>; a linode-cli failure aborts via set -e/pipefail.
rows="$(linode-cli linodes list --json | jq -r --arg tag "$TAG" '.[] | select(.tags | index($tag)) | [.id, .label] | @tsv')"

n=0 fail=0
while IFS=$'\t' read -r id label; do
  [ -n "$id" ] || continue
  if [ "$DRY" -eq 1 ]; then echo "would delete linode $id ($label)"; n=$((n + 1)); continue; fi
  if linode-cli linodes delete "$id"; then
    echo "deleted linode $id ($label)"; n=$((n + 1))
  else
    echo "FAILED linode $id ($label)" >&2; fail=$((fail + 1))
  fi
done <<< "$rows"

echo "teardown_perf_linodes: instances=$n failed=$fail$([ "$DRY" -eq 1 ] && echo ' (dry-run)') [tag=$TAG]"
[ "$fail" -eq 0 ]
