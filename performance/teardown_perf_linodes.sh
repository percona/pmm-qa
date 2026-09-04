#!/usr/bin/env bash
# Delete the load-test client VMs that linode_stackScript_load_pmm3.sh creates.
# Those instances bill until removed, so this is the teardown the create step
# needs.
#
# It defaults to this harness's own pmm-qa-perf tag -- NOT the account-wide
# pmm-qa-ephemeral tag, which the Terraform QA runner (terraform/linode-runner)
# and LKE clusters (linode-ha-provisioning) also stamp. `linode-cli linodes list`
# is account-wide, so defaulting to pmm-qa-ephemeral would delete someone else's
# live instance mid-test. --dry-run lists matches and deletes nothing.
#
#   ./teardown_perf_linodes.sh --dry-run    # preview
#   ./teardown_perf_linodes.sh              # delete every pmm-qa-perf instance
#   PMM_PERF_TAG=pmm-qa-perf-run:20260904-120000 ./teardown_perf_linodes.sh  # one batch
set -Eeuo pipefail

DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1
TAG="${PMM_PERF_TAG:-pmm-qa-perf}"
command -v linode-cli >/dev/null || { echo "linode-cli is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

# jq matches the tag as an exact array element -- a substring/word match would let
# pmm-qa-perf also catch pmm-qa-perf-run:<id>. A linode-cli failure aborts via
# set -e/pipefail rather than yielding an empty list that deletes nothing silently.
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
