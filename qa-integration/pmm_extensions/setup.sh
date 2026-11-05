#!/usr/bin/env bash
#
# Start PMM Server with PMM Extensions, turn on Operations for MongoDB, and add
# a monitored PSMDB replica set whose nodes the Operations scans can log in to.

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
readonly SCRIPT_DIR
readonly COMPOSE_FILE=$SCRIPT_DIR/docker-compose.yml
readonly FRAMEWORK=$SCRIPT_DIR/../pmm_qa/pmm-framework/pmm-framework
readonly PSMDB_NODES=(rs101 rs102 rs103)

PMM_IMAGE_TAG=${PMM_IMAGE_TAG:-3}
PMM_PUBLIC_ADDRESS=${PMM_PUBLIC_ADDRESS:-}
PSMDB_VERSION=8.0
TEARDOWN=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Starts pmm-server and pmm-extensions with Docker Compose, enables Operations
for MongoDB, and adds a PSMDB replica set (rs101-rs103) through pmm-framework.

Options:
  --tag TAG               PMM Server and PMM Extensions tag (default: $PMM_IMAGE_TAG).
                          Both images must run the same version.
  --public-address ADDR   Address PMM Clients and browsers use to reach PMM
                          (default: this host's primary IP).
  --psmdb VERSION|none    PSMDB version for the replica set, or none to skip
                          it (default: $PSMDB_VERSION).
  --teardown              Remove everything this script started, volumes included.
  -h, --help              Show this help.

Environment:
  ADMIN_PASSWORD          PMM admin password (default: admin).
  PMM_SERVER_IMAGE        Override the PMM Server image, e.g. a Feature Build.
  PMM_EXTENSIONS_IMAGE    Override the PMM Extensions image.
  PMM_EXTENSIONS_TOKEN    Shared pmm-server/pmm-extensions token (default: generated).
  CLIENT_VERSION          PMM Client for the MongoDB nodes: a 3.x.y release or a
                          channel (pmm3-latest, pmm3-rc, 3-dev-latest). Defaults to
                          --tag when it is a 3.x.y release, else pmm3-latest.
EOF
}

log() { printf '[%(%H:%M:%S)T] %s\n' -1 "$*"; }
die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

# Usage: retry ATTEMPTS DELAY DESCRIPTION COMMAND...
retry() {
  local attempts=$1 delay=$2 what=$3 i
  shift 3
  for ((i = 1; i <= attempts; i++)); do
    if "$@"; then
      return 0
    fi
    sleep "$delay"
  done
  die "Gave up waiting for $what after $((attempts * delay))s."
}

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

detect_public_address() {
  local address=''
  if [[ $(uname -s) == Darwin ]]; then
    address=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
  else
    address=$(ip -4 route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p')
  fi
  [[ -n $address ]] || die 'Could not detect this host'\''s IP; pass --public-address.'
  printf '%s' "$address"
}

# curl inside pmm-server, so the host's port 443 and certificate do not matter.
# The admin credential goes in over stdin, not argv.
pmm_api() {
  printf 'user = "admin:%s"\n' "${ADMIN_PASSWORD:-admin}" |
    docker exec -i pmm-server curl -sk -K - --max-time 10 "$@"
}

server_ready() {
  docker exec pmm-server curl -fsS --max-time 5 http://127.0.0.1:8080/v1/server/readyz >/dev/null 2>&1
}

extensions_healthy() {
  [[ $(docker inspect -f '{{.State.Health.Status}}' pmm-extensions 2>/dev/null) == healthy ]] &&
    [[ $(docker exec pmm-server curl -sk -o /dev/null -w '%{http_code}' --max-time 5 \
      https://127.0.0.1:8443/extensions/health) == 200 ]]
}

# PMM refuses the switch until its inventory app answers in PMM Extensions.
enable_om() {
  [[ $(pmm_api -o /dev/null -w '%{http_code}' -X PUT -H 'Content-Type: application/json' \
    -d '{"enable_om": true}' https://127.0.0.1:8443/v1/server/settings) == 200 ]]
}

om_enabled() {
  pmm_api https://127.0.0.1:8443/v1/server/settings | grep -q '"om_enabled":[[:space:]]*true'
}

default_client_version() {
  if [[ $PMM_IMAGE_TAG =~ ^3\.[0-9]+\.[0-9]+$ ]]; then
    printf '%s' "$PMM_IMAGE_TAG"
  else
    printf 'pmm3-latest'
  fi
}

# Scans need python3 with venv and iproute on the node, and log in to MongoDB
# with the credentials in /root/.mongodb_uri; pmm/pmmpass has clusterMonitor.
# They dial mongod by the PMM node name (rs101._<suffix>), which only Docker's
# container name (rs101) resolves, so the node maps its own name to itself.
prepare_scan_node() {
  local node=$1 node_name
  log "Preparing $node for Operations for MongoDB scans"
  node_name=$(docker exec "$node" pmm-admin status | sed -n 's/^Node name *: *//p')
  [[ -n $node_name ]] || die "Could not read the PMM node name of $node."
  docker exec --user root "$node" sh -ceu "
    dnf install -y -q python3 iproute >/dev/null
    grep -q ' $node_name\$' /etc/hosts || echo '127.0.0.1 $node_name' >>/etc/hosts
    umask 077
    echo 'mongodb://pmm:pmmpass@127.0.0.1:27017' >/root/.mongodb_uri
    chown root:root /root/.mongodb_uri" || die "Preparing $node failed."
}

# PMM Extensions imports PMM's inventory on its own schedule, so nodes added
# after it started are missing from Operations until the next sync. Its API
# takes only a Grafana bearer token, so a throwaway service account runs it.
sync_extensions_inventory() {
  local account token rc=0
  log 'Syncing the PMM inventory into PMM Extensions'
  account=$(pmm_api -X POST -H 'Content-Type: application/json' -d '{"name":"pmm-qa-setup-sync","role":"Admin"}' \
    https://127.0.0.1:8443/graph/api/serviceaccounts | sed -n 's/.*"id":\([0-9]*\).*/\1/p')
  [[ -n $account ]] || die 'Could not create a Grafana service account for the inventory sync.'
  token=$(pmm_api -X POST -H 'Content-Type: application/json' -d '{"name":"sync"}' \
    "https://127.0.0.1:8443/graph/api/serviceaccounts/$account/tokens" | sed -n 's/.*"key":"\([^"]*\)".*/\1/p')
  if [[ -z $token ]] || [[ $(printf 'header = "Authorization: Bearer %s"\n' "$token" |
    docker exec -i pmm-server curl -sk -K - -o /dev/null -w '%{http_code}' -X POST \
      https://127.0.0.1:8443/extensions/api/apps/inventory/sync/) != 202 ]]; then
    rc=1
  fi
  pmm_api -o /dev/null -X DELETE "https://127.0.0.1:8443/graph/api/serviceaccounts/$account" || true
  ((rc == 0)) || die 'PMM Extensions did not accept the inventory sync.'
}

scan_status() {
  pmm_api "https://127.0.0.1:8443/v1/om/inventory/runs/$1" | sed -n '/"status": *"RUN_STATUS_/{s/.*"status": *"\(RUN_STATUS_[A-Z]*\)".*/\1/p;q;}'
}

scan_finished() {
  [[ $(scan_status "$1") != RUN_STATUS_RUNNING ]]
}

# The synced services can lag the sync's 202 by a few seconds; a scan that
# starts before them finds only the PMM Server host.
first_scan() {
  local run status
  sleep 15
  log 'Running the first Operations for MongoDB scan'
  run=$(pmm_api -X POST -H 'Content-Type: application/json' -d '{}' \
    'https://127.0.0.1:8443/v1/om/inventory/runs:trigger' | sed -n '/"run_id": *"/{s/.*"run_id": *"\([^"]*\)".*/\1/p;q;}')
  [[ -n $run ]] || die 'PMM did not start a scan.'
  retry 60 5 "scan $run to finish" scan_finished "$run"
  status=$(scan_status "$run")
  log "Scan $run: $status"
  [[ $status == RUN_STATUS_SUCCESS ]] ||
    log "WARNING: see MongoDB > Operations > Automations > Scans for what $run could not collect."
}

setup_mongodb() {
  local client=${CLIENT_VERSION:-$(default_client_version)}
  log "Adding a PSMDB $PSMDB_VERSION replica set with PMM Client $client"
  ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin} "$FRAMEWORK" \
    --database "psmdb=$PSMDB_VERSION,SETUP_TYPE=pss,CLIENT_VERSION=$client"
  local node
  for node in "${PSMDB_NODES[@]}"; do
    prepare_scan_node "$node"
  done
  sync_extensions_inventory
  first_scan
}

teardown() {
  log 'Removing the PSMDB replica set'
  docker compose -p psmdb_pss down -v --remove-orphans || true
  log 'Removing pmm-server and pmm-extensions'
  PMM_PUBLIC_ADDRESS=unused PMM_EXTENSIONS_TOKEN=unused compose down -v --remove-orphans
}

main() {
  while (($#)); do
    case $1 in
      --tag) PMM_IMAGE_TAG=${2:?--tag needs a value}; shift ;;
      --public-address) PMM_PUBLIC_ADDRESS=${2:?--public-address needs a value}; shift ;;
      --psmdb) PSMDB_VERSION=${2:?--psmdb needs a value}; shift ;;
      --teardown) TEARDOWN=true ;;
      -h | --help) usage; exit 0 ;;
      *) usage >&2; die "Unknown option: $1" ;;
    esac
    shift
  done

  command -v docker >/dev/null || die 'docker is not installed.'
  docker compose version >/dev/null 2>&1 || die 'The Docker Compose v2 plugin is not installed.'

  if [[ $TEARDOWN == true ]]; then
    teardown
    return
  fi

  if [[ $(docker info -f '{{.Architecture}}') != x86_64 ]]; then
    log 'WARNING: PMM Extensions is published for amd64 only; it will run under emulation, if at all.'
  fi

  [[ -n $PMM_PUBLIC_ADDRESS ]] || PMM_PUBLIC_ADDRESS=$(detect_public_address)
  PMM_EXTENSIONS_TOKEN=${PMM_EXTENSIONS_TOKEN:-$(openssl rand -hex 32)}
  export PMM_IMAGE_TAG PMM_PUBLIC_ADDRESS PMM_EXTENSIONS_TOKEN ADMIN_PASSWORD

  docker network inspect pmm-qa >/dev/null 2>&1 || docker network create pmm-qa >/dev/null

  log "Starting pmm-server and pmm-extensions ($PMM_IMAGE_TAG), public address $PMM_PUBLIC_ADDRESS"
  compose up -d --pull missing
  retry 90 5 'PMM Server to become ready' server_ready
  log 'PMM Server is ready; waiting for PMM Extensions (first start takes a few minutes)'
  retry 120 5 'PMM Extensions to become healthy' extensions_healthy

  log 'Enabling Operations for MongoDB'
  retry 24 5 'PMM to accept enabling Operations for MongoDB' enable_om
  om_enabled || die 'PMM accepted the change, but Operations for MongoDB still reads as off.'

  if [[ ${PSMDB_VERSION,,} != none ]]; then
    setup_mongodb
  fi

  cat <<EOF

PMM is ready: https://$PMM_PUBLIC_ADDRESS (admin / ${ADMIN_PASSWORD:-admin})
  Apps:                    sidebar > Apps (MySQL Backups, Support diagnostics)
  Operations for MongoDB:  sidebar > MongoDB > Operations (Fleet, Nodes, Automations, Settings)
  Extensions health:       https://$PMM_PUBLIC_ADDRESS/extensions/health

Nodes are scanned every 10 minutes; use Scan all on the Nodes page to scan now.
Tear down with: $0 --teardown
EOF
}

main "$@"
