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
prepare_scan_node() {
  local node=$1
  log "Preparing $node for Operations for MongoDB scans"
  docker exec --user root "$node" sh -ceu '
    dnf install -y -q python3 iproute >/dev/null
    umask 077
    echo "mongodb://pmm:pmmpass@127.0.0.1:27017" >/root/.mongodb_uri
    chown root:root /root/.mongodb_uri' || die "Preparing $node failed."
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
