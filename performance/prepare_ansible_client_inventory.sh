#!/usr/bin/env bash
# Build the Ansible inventory of load-test client VMs from the live Linode list.
# Matches the same label prefix the create step uses (sp_fb_) so the two scripts
# actually line up; override with PERF_LABEL_MATCH.
set -Eeuo pipefail

INVENTORY="${INVENTORY_FILE:-inventory_client_container2}"
LABEL_MATCH="${PERF_LABEL_MATCH:-sp_fb_}"
SSH_KEY="${PMM_PERF_SSH_KEY:-$HOME/.ssh/id_rsa}"
command -v linode-cli >/dev/null || { echo "linode-cli is required" >&2; exit 1; }

# Capture the listing first so a linode-cli failure aborts (set -e) instead of
# silently producing an empty inventory.
raw="$(linode-cli linodes list --format 'id,ipv4,label' --text --delimiter ';' --no-headers)"

{
  echo "[linode_clients]"
  printf '%s\n' "$raw" \
    | grep -- "$LABEL_MATCH" \
    | awk -F ';' -v key="$SSH_KEY" '{print $2" ansible_ssh_user=root ansible_ssh_private_key_file="key}' \
    || true
} > "$INVENTORY"

count=$(($(wc -l < "$INVENTORY") - 1))
echo "wrote $count host(s) matching '$LABEL_MATCH' to $INVENTORY"
[ "$count" -gt 0 ] || echo "warning: no instances matched '$LABEL_MATCH'" >&2
