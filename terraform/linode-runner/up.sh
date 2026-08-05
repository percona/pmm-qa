#!/usr/bin/env bash
# up.sh -- provision a throwaway Linode VM for one QA run.
#
# Usage:
#   LINODE_TOKEN=... terraform/linode-runner/up.sh <role> <run_id> [terraform -var overrides...]
#
# Examples:
#   up.sh test-runner PMM-15196
#   up.sh fb-validator heal-4376 -var ttl_hours=6 -var region=us-east
#   PMM_QA_REF=fix/some-branch up.sh fb-validator heal-4376
#
# On success, writes runs/<run_id>/{ip,exec_token,role} and clones
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

case "$RUN_ID" in
  ''|.|..|*/*)
    echo "invalid run_id '$RUN_ID' -- must be a single path component (no '/', not '.' or '..')" >&2
    exit 1
    ;;
esac
if ! [[ "$RUN_ID" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "invalid run_id '$RUN_ID' -- letters, digits, '.', '_', '-' only" >&2
  exit 1
fi

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

# A failure anywhere below this point (health poll, cloud-init poll, git
# clone) would otherwise leave a billable instance nobody torn down.
# Disarmed only after everything below succeeds.
cleanup_on_error() {
  echo "up.sh failed after provisioning -- tearing down run_id=$RUN_ID so it doesn't keep billing" >&2
  "$MODULE_DIR/down.sh" "$RUN_ID" || true
}
trap cleanup_on_error ERR

terraform -chdir="$MODULE_DIR" init -input=false -upgrade=false >/dev/null

terraform -chdir="$MODULE_DIR" apply -auto-approve -input=false \
  -state="$STATE" \
  -var "role=$ROLE" \
  -var "run_id=$RUN_ID" \
  "$@"

IP=$(terraform -chdir="$MODULE_DIR" output -state="$STATE" -raw ip_address)
TOKEN=$(terraform -chdir="$MODULE_DIR" output -state="$STATE" -raw exec_token)

echo "$IP" >"$RUN_DIR/ip"
echo "$TOKEN" >"$RUN_DIR/exec_token"
chmod 600 "$RUN_DIR/exec_token"
echo "$ROLE" >"$RUN_DIR/role"
terraform -chdir="$MODULE_DIR" output -state="$STATE" -raw exec_cert_pem >"$RUN_DIR/exec_cert.pem"

# Tags this run with the Claude Code session that provisioned it, so
# session-end-cleanup.sh only ever tears down its own runs -- not another
# concurrent session's, if more than one happens to share this working tree.
if [ -n "${CLAUDE_CODE_SESSION_ID:-}" ]; then
  echo "$CLAUDE_CODE_SESSION_ID" >"$RUN_DIR/session_id"
fi

HOST="exec-$(echo "$IP" | tr '.' '-').nip.io"

echo "Instance up: $IP (exec-server reachable as https://$HOST) -- waiting for it to answer..."
health_ready=0
for _ in $(seq 1 30); do
  if curl -sS -m 5 --cacert "$RUN_DIR/exec_cert.pem" "https://$HOST/health" >/dev/null 2>&1; then
    health_ready=1
    break
  fi
  sleep 10
done
if [ "$health_ready" -ne 1 ]; then
  echo "exec-server did not come up in 5 minutes -- check the instance manually (IP: $IP)." >&2
  exit 1
fi

echo "exec-server reachable -- waiting for cloud-init (Docker + Ansible) to finish..."
ready=0
for _ in $(seq 1 60); do
  if "$MODULE_DIR/run.sh" "$RUN_ID" -- 'test -f /var/lib/cloud/pmm-qa-cloud-init-done' 2>/dev/null; then
    ready=1
    break
  fi
  sleep 10
done
if [ "$ready" -ne 1 ]; then
  echo "cloud-init did not finish in 10 minutes -- check manually via run.sh $RUN_ID -- <cmd>" >&2
  exit 1
fi

echo "Cloning percona/pmm-qa @ $PMM_QA_REF onto the runner..."
"$MODULE_DIR/run.sh" "$RUN_ID" -- "git clone --depth 1 --branch '$PMM_QA_REF' https://github.com/percona/pmm-qa.git /root/pmm-qa"

trap - ERR

PMM_HOST="$(echo "$IP" | tr '.' '-').nip.io"
echo
echo "Linode VM ready: run_id=$RUN_ID role=$ROLE ip=$IP ref=$PMM_QA_REF"
echo "  exec-server: https://$HOST (used by run.sh/sync.sh/extend.sh/down.sh)"
echo "  PMM Server (once brought up):  https://$PMM_HOST (any hostname without the exec- prefix routes here)"
echo "Next:  terraform/linode-runner/run.sh $RUN_ID -- <remote command>"
echo "Then:  terraform/linode-runner/down.sh $RUN_ID"
