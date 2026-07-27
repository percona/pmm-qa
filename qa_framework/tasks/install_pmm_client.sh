#!/usr/bin/env bash
#
# install_pmm_client.sh — shell port of tasks/install_pmm_client.yml.
# Installs and connects the PMM client inside an existing docker container.
#
# Required:
#   CONTAINER_NAME   target container
# Optional (env, with defaults matching the playbook):
#   CLIENT_VERSION   3-dev-latest | pmm3-rc | pmm3-latest | 3.x.y | https://...tar.gz
#                    (default: 3-dev-latest)
#   PMM_SERVER_IP    server address (default: auto-detect running *-server container)
#   ADMIN_PASSWORD   PMM admin password        (default: admin)
#   METRICS_MODE     metrics mode              (default: auto; empty => omit flag)
#   ENCRYPTED_CLIENT_CONFIG  true|false        (default: false)
#   DEBUG_CLIENT     true|false                (default: false)
set -euo pipefail

# port from server address: >=3 dots (an IP) -> 443, else (hostname) -> 8443
port_for() { local d="${1//[^.]/}"; [[ ${#d} -ge 3 ]] && echo 443 || echo 8443; }
# encrypted config supported: feature added in client 3.7.0
enc_ok() { # $1=version
  case "$1" in
    3-dev-latest|pmm3-rc|pmm3-latest|latest-tarball|http://*|https://*) return 0 ;;
    3.*.*) [[ "$(printf '%s\n' 3.7.0 "$1" | sort -V | head -n1)" == 3.7.0 ]] && return 0 ;;
  esac
  return 1
}

if [[ "${1:-}" == "--selfcheck" ]]; then
  [[ $(port_for 10.0.0.5) == 443 ]]        || { echo FAIL ip; exit 1; }
  [[ $(port_for pmm-server) == 8443 ]]     || { echo FAIL host; exit 1; }
  enc_ok 3.7.0                             || { echo FAIL 3.7.0; exit 1; }
  ! enc_ok 3.6.9                           || { echo FAIL 3.6.9; exit 1; }
  enc_ok 3-dev-latest                      || { echo FAIL dev; exit 1; }
  echo "selfcheck OK"; exit 0
fi

CONTAINER_NAME="${CONTAINER_NAME:?CONTAINER_NAME is required}"
CLIENT_VERSION="${CLIENT_VERSION:-3-dev-latest}"
PMM_SERVER_IP="${PMM_SERVER_IP:-127.0.0.1}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
METRICS_MODE="${METRICS_MODE:-auto}"
ENCRYPTED_CLIENT_CONFIG="${ENCRYPTED_CLIENT_CONFIG:-false}"
DEBUG_CLIENT="${DEBUG_CLIENT:-false}"

dexec() { docker exec --user root "$CONTAINER_NAME" "$@"; }
is_true() { [[ "${1,,}" == "true" ]]; }

# ---- Resolve server address + port ----
if [[ "$PMM_SERVER_IP" == "127.0.0.1" ]]; then
  PMM_SERVER_IP="$(docker ps -f name=-server --format '{{.Names}}' | head -n1)"
fi
PMM_SERVER_PORT="$(port_for "$PMM_SERVER_IP")"

# ---- Detect distro family ----
os="$(dexec cat /etc/os-release | tr '[:upper:]' '[:lower:]')"
if grep -q debian <<<"$os"; then DISTRO=debian
elif grep -qE 'rhel|centos|fedora' <<<"$os"; then DISTRO=rhel
else echo "Unsupported distro" >&2; exit 1; fi

# ---- Dependencies + percona-release ----
if [[ "$DISTRO" == debian ]]; then
  dexec apt-get update
  dexec apt-get install -y wget gnupg2 jq lsb-base lsb-release curl
  dexec wget -q https://repo.percona.com/apt/percona-release_latest.generic_all.deb || true
  dexec apt install -y ./percona-release_latest.generic_all.deb || true
else
  dexec dnf install -y microdnf || true
  dexec microdnf install -y wget gnupg2 jq
  dexec microdnf install -y curl-minimal || true
  dexec wget -q https://repo.percona.com/yum/percona-release-latest.noarch.rpm || true
  dexec microdnf -y install ./percona-release-latest.noarch.rpm || true
fi

# ---- Install pmm-client ----
# retry wrapper: 3 tries, 30s apart (matches playbook)
retry() { local n=0; until "$@"; do n=$((n+1)); [[ $n -ge 3 ]] && return 1; sleep 30; done; }

install_from_repo() {  # $1 = repo component (experimental|testing|release)
  if [[ "$DISTRO" == debian ]]; then
    retry bash -c "docker exec --user root '$CONTAINER_NAME' percona-release enable-only pmm3-client $1 \
      && docker exec --user root '$CONTAINER_NAME' apt-get update \
      && docker exec --user root '$CONTAINER_NAME' apt-get -y install pmm-client"
  else
    retry bash -c "docker exec --user root '$CONTAINER_NAME' percona-release enable-only pmm3-client $1 \
      && docker exec --user root '$CONTAINER_NAME' microdnf install -y pmm-client"
  fi
}

install_specific_version() {  # exact 3.x.y from repo pool
  dexec bash -c '
    build_number=7
    client_version="'"$CLIENT_VERSION"'"
    minor_version=${client_version#3.}; minor_version=${minor_version%%.*}
    if [ "$client_version" = "3.7.1" ] || [ "$client_version" = "3.8.0" ]; then build_number=8
    elif [ "$client_version" = "3.8.1" ] || [ "$minor_version" -gt 8 ]; then build_number=1; fi
    if command -v dpkg >/dev/null; then
      wget -O /pmm-client.deb "https://repo.percona.com/pmm3-client/apt/pool/main/p/pmm-client/pmm-client_${client_version}-${build_number}.$(lsb_release -sc)_amd64.deb"
      dpkg -i /pmm-client.deb
    else
      wget -O /pmm-client.rpm "https://repo.percona.com/pmm3-client/yum/release/9/RPMS/x86_64/pmm-client-${client_version}-${build_number}.el9.x86_64.rpm"
      rpm -i /pmm-client.rpm
    fi
  '
}

install_tarball() {  # $1 = tarball URL
  dexec sh -c '
    wget -O /pmm-client.tar.gz "'"$1"'" &&
    tar -zxpf /pmm-client.tar.gz &&
    PMM_CLIENT=$(ls -1td pmm-client* 2>/dev/null | grep -v ".tar" | grep -v ".sh" | head -n1) &&
    rm -rf pmm-client && mv "$PMM_CLIENT" pmm-client &&
    rm -rf /usr/local/bin/pmm-client && mv -f pmm-client /usr/local/bin &&
    bash -x /usr/local/bin/pmm-client/install_tarball &&
    ln -sf /usr/local/percona/pmm/bin/pmm-admin /usr/local/bin/pmm-admin &&
    ln -sf /usr/local/percona/pmm/bin/pmm-agent /usr/local/bin/pmm-agent &&
    pmm-admin --version
  '
}

case "$CLIENT_VERSION" in
  3-dev-latest)               install_from_repo experimental ;;
  pmm3-rc)                    install_from_repo testing ;;
  pmm3-latest)                install_from_repo release ;;
  http://*.tar.gz|https://*.tar.gz) install_tarball "$CLIENT_VERSION" ;;
  3.*.*)                      install_specific_version ;;
  *) echo "Unknown CLIENT_VERSION: $CLIENT_VERSION" >&2; exit 1 ;;
esac

# ---- Encrypted config supported? (feature added in client 3.7.0) ----
USE_ENC=false
if is_true "$ENCRYPTED_CLIENT_CONFIG" && enc_ok "$CLIENT_VERSION"; then USE_ENC=true; fi

DEBUG_FLAG=""; is_true "$DEBUG_CLIENT" && DEBUG_FLAG="--debug"
METRICS_FLAG=""; [[ -n "$METRICS_MODE" ]] && METRICS_FLAG="--metrics-mode=$METRICS_MODE"

# ---- Connect (pmm-agent setup) ----
if is_true "$USE_ENC"; then
  dexec openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -aes256 \
    -pass pass:testpass -out /usr/local/percona/pmm/config/pmm-key.pem
  dexec pmm-agent setup \
    --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml \
    --server-address="${PMM_SERVER_IP}:${PMM_SERVER_PORT}" \
    --custom-labels="role=pmm-client, encrypted=true, password=true" \
    --server-insecure-tls $METRICS_FLAG \
    --server-username=admin --server-password="$ADMIN_PASSWORD" \
    --config-file-key-file="/usr/local/percona/pmm/config/pmm-key.pem" \
    --config-file-key-password="testpass" $DEBUG_FLAG \
    "$CONTAINER_NAME"
else
  dexec pmm-agent setup \
    --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml \
    --server-address="${PMM_SERVER_IP}:${PMM_SERVER_PORT}" \
    --server-insecure-tls $METRICS_FLAG \
    --server-username=admin --server-password="$ADMIN_PASSWORD" $DEBUG_FLAG \
    "$CONTAINER_NAME"
fi

sleep 5

# ---- Start the agent ----
if is_true "$USE_ENC"; then
  dexec sh -c 'nohup pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml --config-file-key-file="/usr/local/percona/pmm/config/pmm-key.pem" --config-file-key-password="testpass" > /var/log/pmm-agent.log 2>&1 &'
else
  dexec sh -c 'nohup pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml > /var/log/pmm-agent.log 2>&1 &'
fi
sleep 5
echo "PMM client installed and connected in $CONTAINER_NAME."
