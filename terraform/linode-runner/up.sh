#!/usr/bin/env bash
# up.sh -- provision a throwaway Linode VM for one QA run.
#
# Usage:
#   LINODE_TOKEN=... terraform/linode-runner/up.sh <role> <run_id> [terraform -var overrides...]
#
# Examples:
#   up.sh test-runner PMM-15196
#   up.sh test-healer heal-4376 -var ttl_hours=6 -var region=us-east
#   PMM_QA_REF=fix/some-branch up.sh test-healer heal-4376
#
# On success, writes runs/<run_id>/{ip,ssh_key_path,role} and clones
# percona/pmm-qa (default ref: main; override with PMM_QA_REF) onto the box
# with plain git -- never rsyncs this session's own working tree. Claude
# never edits code on the VM: any change under test must already be
# committed and pushed to a branch first, then PMM_QA_REF names it. Use
# sync.sh to re-fetch/switch branch on an already-running box.
set -euo pipefail

MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROLE="${1:?usage: up.sh <role> <run_id> [terraform -var overrides...]}"
RUN_ID="${2:?usage: up.sh <role> <run_id> [terraform -var overrides...]}"
shift 2

: "${LINODE_TOKEN:?LINODE_TOKEN must be set -- export it, never hardcode it}"
PMM_QA_REF="${PMM_QA_REF:-main}"

RUN_DIR="$MODULE_DIR/runs/$RUN_ID"
if [ -f "$RUN_DIR/terraform.tfstate" ]; then
  echo "run_id '$RUN_ID' already has a state file at $RUN_DIR -- pick a unique run_id, or down.sh it first." >&2
  exit 1
fi
mkdir -p "$RUN_DIR"

export TF_DATA_DIR="$RUN_DIR/.terraform"
export TF_PLUGIN_CACHE_DIR="$MODULE_DIR/.plugin-cache"
export TF_VAR_linode_token="$LINODE_TOKEN"
mkdir -p "$TF_PLUGIN_CACHE_DIR"
STATE="$RUN_DIR/terraform.tfstate"

terraform -chdir="$MODULE_DIR" init -input=false -upgrade=false >/dev/null

terraform -chdir="$MODULE_DIR" apply -auto-approve -input=false \
  -state="$STATE" \
  -var "role=$ROLE" \
  -var "run_id=$RUN_ID" \
  "$@"

IP=$(terraform -chdir="$MODULE_DIR" output -state="$STATE" -raw ip_address)
KEY=$(terraform -chdir="$MODULE_DIR" output -state="$STATE" -raw ssh_private_key_path)

echo "$IP" >"$RUN_DIR/ip"
echo "$KEY" >"$RUN_DIR/ssh_key_path"
echo "$ROLE" >"$RUN_DIR/role"

SSH=(ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10 -i "$KEY")

echo "Instance up: $IP -- waiting for cloud-init (Docker + Ansible) to finish..."
ready=0
for _ in $(seq 1 60); do
  if "${SSH[@]}" "root@$IP" 'test -f /var/lib/cloud/pmm-qa-cloud-init-done' 2>/dev/null; then
    ready=1
    break
  fi
  sleep 10
done
if [ "$ready" -ne 1 ]; then
  echo "cloud-init did not finish in 10 minutes -- check manually: ${SSH[*]} root@$IP" >&2
  exit 1
fi

echo "Cloning percona/pmm-qa @ $PMM_QA_REF onto the runner..."
"${SSH[@]}" "root@$IP" "git clone --depth 1 --branch '$PMM_QA_REF' https://github.com/percona/pmm-qa.git /root/pmm-qa"

echo
echo "Linode VM ready: run_id=$RUN_ID role=$ROLE ip=$IP ref=$PMM_QA_REF"
echo "Next:  terraform/linode-runner/run.sh $RUN_ID -- <remote command>"
echo "Then:  terraform/linode-runner/down.sh $RUN_ID"
