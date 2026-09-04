#!/usr/bin/env bash
# Provision N Linode PMM client load-test VMs for one DB type via a Percona
# StackScript. Each instance is tagged pmm-qa-perf-run:<PERF_RUN_ID> so its batch
# can be found for inventory and teardown; credentials come from the environment.
set -Eeuo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: linode_stackScript_load_pmm3.sh <pmm_server_host> <client_version> <instances> <metrics_mode> <dbtype>
  dbtype: mysql | postgresql | mongodb

Required environment:
  LINODE_ROOT_PASS     root password for the provisioned VMs
  PMM_PERF_SSH_PUBKEY  SSH public key to authorize on the provisioned VMs
  PMM_SERVER_PASSWORD  PMM server admin password (from env; still reaches
                       linode-cli via --stackscript_data, so visible in ps)

Optional environment:
  LINODE_REGION        default: us-east
  LINODE_TYPE          default: g6-standard-2
  PERF_RUN_ID          batch id, tagged pmm-qa-perf-run:<id> and put in the
                       label so batches don't collide; default: UTC timestamp
EOF
  exit 2
}

[ "$#" -eq 5 ] || usage
PMM_SERVER_HOST=$1
CLIENT_VERSION=$2
INSTANCES=$3
METRICS_MODE=$4
DBTYPE=$5

: "${LINODE_ROOT_PASS:?set LINODE_ROOT_PASS (do not hardcode)}"
: "${PMM_PERF_SSH_PUBKEY:?set PMM_PERF_SSH_PUBKEY (do not hardcode)}"
: "${PMM_SERVER_PASSWORD:?set PMM_SERVER_PASSWORD}"
LINODE_REGION=${LINODE_REGION:-us-east}
LINODE_TYPE=${LINODE_TYPE:-g6-standard-2}
PERF_RUN_ID=${PERF_RUN_ID:-$(date -u +%Y%m%d-%H%M%S)}

[[ "$INSTANCES" =~ ^[1-9][0-9]*$ ]] || { echo "instances must be a positive integer, got: $INSTANCES" >&2; exit 2; }
case "$DBTYPE" in
  mysql)      STACKSCRIPT_ID=1611994; hostprefix=li_client_mysql ;;
  postgresql) STACKSCRIPT_ID=1612038; hostprefix=li_client_pgsql ;;
  mongodb)    STACKSCRIPT_ID=2046257; hostprefix=li_client_mongodb ;;
  *) echo "unknown dbtype: $DBTYPE (expected mysql|postgresql|mongodb)" >&2; exit 2 ;;
esac

command -v linode-cli >/dev/null || { echo "linode-cli is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 1; }

# Print the batch id and its teardown before provisioning, so a failure partway
# through the loop still leaves the operator the id needed to clean up.
echo "provisioning batch PERF_RUN_ID=${PERF_RUN_ID} (${INSTANCES} ${DBTYPE} client(s))"
echo "inventory:  PERF_RUN_ID=${PERF_RUN_ID} ./prepare_ansible_client_inventory.sh"
echo "teardown:   PMM_PERF_TAG=pmm-qa-perf-run:${PERF_RUN_ID} ./teardown_perf_linodes.sh"

# Nothing reaps stray Linode instances automatically, so an interrupted run would
# leak billing VMs -- tear this batch down on any error. ERR covers a failed
# command; the signal traps cover a CI cancel/timeout (SIGTERM/SIGINT), which does
# NOT fire ERR. Best-effort: a hard SIGKILL still can't be trapped, so an
# out-of-band tag-expiry reaper is the real backstop (see PR discussion).
cleanup_on_fail() {
  echo "provisioning interrupted -- tearing down batch pmm-qa-perf-run:${PERF_RUN_ID}" >&2
  PMM_PERF_TAG="pmm-qa-perf-run:${PERF_RUN_ID}" bash "$(dirname "$0")/teardown_perf_linodes.sh" || true
}
trap cleanup_on_fail ERR
trap 'cleanup_on_fail; exit 143' TERM
trap 'cleanup_on_fail; exit 130' INT
trap 'cleanup_on_fail; exit 129' HUP

for i in $(seq 1 "$INSTANCES"); do
  hostname="${hostprefix}_${METRICS_MODE}_${i}"
  label="sp_fb_${i}_${DBTYPE}_${METRICS_MODE}_${PERF_RUN_ID}"
  ssdata="$(jq -nc \
    --arg hostname "$hostname" \
    --arg pmmserver "$PMM_SERVER_HOST" \
    --arg pmmpassword "$PMM_SERVER_PASSWORD" \
    --arg clientversion "$CLIENT_VERSION" \
    --arg metricsmode "$METRICS_MODE" \
    '{hostname:$hostname, pmmserver:$pmmserver, pmmpassword:$pmmpassword, clientversion:$clientversion, metricsmode:$metricsmode}')"

  linode-cli linodes create \
    --type "$LINODE_TYPE" \
    --image linode/ubuntu22.04 \
    --label "$label" \
    --stackscript_id "$STACKSCRIPT_ID" \
    --stackscript_data "$ssdata" \
    --root_pass "$LINODE_ROOT_PASS" \
    --region "$LINODE_REGION" \
    --tags pmm-qa-perf \
    --tags "pmm-qa-perf-run:${PERF_RUN_ID}" \
    --authorized_keys "$PMM_PERF_SSH_PUBKEY"
  sleep 15   # pace Linode API / StackScript provisioning to avoid rate-limit errors
done

trap - ERR TERM INT HUP
echo "created ${INSTANCES} ${DBTYPE} client(s) as batch PERF_RUN_ID=${PERF_RUN_ID}"
