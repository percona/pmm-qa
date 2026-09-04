#!/usr/bin/env bash
# Provision N Linode PMM client load-test VMs for one DB type via a Percona
# StackScript. Every instance is tagged pmm-qa-ephemeral so its teardown
# counterpart (teardown_perf_linodes.sh) can find and delete it -- these VMs bill
# until removed, so nothing here creates an untagged, unattributable instance.
#
# Credentials come from the environment, never from source: the VM root password
# and the authorized SSH key were previously hardcoded here and must stay out of
# the repo.
set -Eeuo pipefail

usage() {
  cat >&2 <<'EOF'
Usage: linode_stackScript_load_pmm3.sh <pmm_server_host> <client_version> <instances> <metrics_mode> <dbtype>
  dbtype: mysql | postgresql | mongodb

Required environment:
  LINODE_ROOT_PASS     root password for the provisioned VMs
  PMM_PERF_SSH_PUBKEY  SSH public key to authorize on the provisioned VMs
  PMM_SERVER_PASSWORD  PMM server admin password (kept off this script's argv)

Optional environment:
  LINODE_REGION        default: us-east
  LINODE_TYPE          default: g6-standard-2
  PERF_RUN_ID          groups this batch under tag pmm-qa-perf-run:<id>; default: UTC timestamp
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

for i in $(seq 1 "$INSTANCES"); do
  hostname="${hostprefix}_${METRICS_MODE}_${i}"
  label="sp_fb_${i}_${DBTYPE}_${METRICS_MODE}_test"
  # jq builds the JSON so a value containing a quote or backslash can't break it.
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
    --tags pmm-qa-ephemeral \
    --tags pmm-qa-perf \
    --tags "pmm-qa-perf-run:${PERF_RUN_ID}" \
    --authorized_keys "$PMM_PERF_SSH_PUBKEY"
  sleep 15
done

echo "created ${INSTANCES} ${DBTYPE} client(s), tagged pmm-qa-ephemeral / pmm-qa-perf-run:${PERF_RUN_ID}"
echo "tear them down with: ./teardown_perf_linodes.sh    (or --dry-run to preview)"
