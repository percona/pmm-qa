#!/usr/bin/env bash
# Build the Ansible inventory for one provisioned batch, selected by its
# pmm-qa-perf-run:<PERF_RUN_ID> tag (not by label, which is account-wide).
set -Eeuo pipefail

INVENTORY="inventory_client_container2"   # git-ignored; keep the name in sync with .gitignore
: "${PERF_RUN_ID:?set PERF_RUN_ID to the batch you provisioned}"
SSH_KEY="${PMM_PERF_SSH_KEY:-$HOME/.ssh/id_rsa}"
RUN_TAG="pmm-qa-perf-run:${PERF_RUN_ID}"
command -v linode-cli >/dev/null || { echo "linode-cli is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

# linode-cli lists account-wide and defaults to one 100-row page; walk pages at the
# 500 max until a short one so a busy account can't silently shorten the batch.
list_all() {
  local page=1 got
  while :; do
    got="$(linode-cli linodes list --json --page "$page" --page-size 500)"
    printf '%s' "$got" | jq -c '.[]'
    [ "$(printf '%s' "$got" | jq 'length')" -lt 500 ] && break
    page=$((page + 1))
  done
}

hosts="$(list_all | jq -r --arg tag "$RUN_TAG" 'select(.tags | index($tag)) | .ipv4[0] // empty')"

{
  echo "[linode_clients]"
  printf '%s\n' "$hosts" | sed '/^$/d' | while read -r ip; do
    echo "${ip} ansible_ssh_user=root ansible_ssh_private_key_file=\"${SSH_KEY}\""
  done
} > "$INVENTORY"

count=$(($(wc -l < "$INVENTORY") - 1))
echo "wrote $count host(s) for $RUN_TAG to $INVENTORY"
[ "$count" -gt 0 ] || { echo "no instances matched $RUN_TAG" >&2; exit 1; }
