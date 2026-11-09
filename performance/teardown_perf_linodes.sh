#!/usr/bin/env bash
# Delete the load-test client VMs from linode_stackScript_load_pmm3.sh. Scoped to
# this harness's own pmm-qa-perf tag, never the account-wide pmm-qa-ephemeral (the
# Terraform QA runner and LKE clusters carry that too, and linode-cli lists
# account-wide). See README.md for usage.
set -Eeuo pipefail

DRY=0
case "$#" in
  0) ;;
  1) [ "$1" = "--dry-run" ] || { echo "usage: $0 [--dry-run]" >&2; exit 2; }; DRY=1 ;;
  *) echo "usage: $0 [--dry-run]" >&2; exit 2 ;;
esac

TAG="${PMM_PERF_TAG:-pmm-qa-perf}"
# Refuse any tag outside this harness's own scope, so PMM_PERF_TAG can never point
# teardown at a shared tag like pmm-qa-ephemeral.
case "$TAG" in
  pmm-qa-perf|pmm-qa-perf-run:?*) ;;
  *) echo "refusing PMM_PERF_TAG='$TAG': only pmm-qa-perf or pmm-qa-perf-run:<id>" >&2; exit 2 ;;
esac
command -v linode-cli >/dev/null || { echo "linode-cli is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

# linode-cli lists account-wide and defaults to one 100-row page; walk pages at the
# 500 max until a short one, so a busy account can't hide instances from teardown.
list_all() {
  local page=1 got
  while :; do
    got="$(linode-cli linodes list --json --page "$page" --page-size 500)"
    printf '%s' "$got" | jq -c '.[]'
    [ "$(printf '%s' "$got" | jq 'length')" -lt 500 ] && break
    page=$((page + 1))
  done
}

# index() matches the tag as an exact array element, so pmm-qa-perf can't also
# catch pmm-qa-perf-run:<id>.
rows="$(list_all | jq -r --arg tag "$TAG" 'select(.tags | index($tag)) | [.id, .label] | @tsv')"

n=0 fail=0
while IFS=$'\t' read -r id label; do
  [ -n "$id" ] || continue
  if [ "$DRY" -eq 1 ]; then echo "would delete linode $id ($label)"; n=$((n + 1)); continue; fi
  if linode-cli linodes delete "$id" </dev/null; then   # </dev/null: don't let it consume the row here-string
    echo "deleted linode $id ($label)"; n=$((n + 1))
  else
    echo "FAILED linode $id ($label)" >&2; fail=$((fail + 1))
  fi
done <<< "$rows"

echo "teardown_perf_linodes: instances=$n failed=$fail$([ "$DRY" -eq 1 ] && echo ' (dry-run)') [tag=$TAG]"
[ "$fail" -eq 0 ]
