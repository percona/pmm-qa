#!/usr/bin/env bash
#
# lib/pmm_client.sh -- PMM Client in a setup's containers: fetch and install it,
# start and register pmm-agent, and wait for its exporters.

readonly PMM_AGENT_CONFIG=/usr/local/percona/pmm/config/pmm-agent.yaml
readonly PMM_AGENT_KEY=/usr/local/percona/pmm/config/pmm-key.pem
readonly PMM_REPO_ERRORS='mirrors were tried|inconsistent server data|curl error|could not resolve|timed out|status code: 5'
readonly PMM_TRANSIENT_ERRORS='connection refused|connection reset|no such host|timeout|timed out|eof|handshake|internal server error|50[0234]'

# Download a PMM Client tarball once per URL, revalidating the cached copy with
# If-Modified-Since. An unreachable build cache falls back to the cached copy.
# A CLIENT that is not a URL (a package channel or release) prints nothing.
# Stdout: the path of the cached tarball
fetch_client_tarball() {
  local url=$1 dir=${XDG_CACHE_HOME:-$HOME/.cache}/pmm-framework file temp lock
  local -a since=()
  [[ $url == http* ]] || return 0
  file=$dir/pmm-client-$(printf '%s' "$url" | sha256sum | cut -c1-16).tar.gz
  must mkdir -p "$dir"
  # One download per URL; parallel setups wait, then revalidate it.
  exec {lock}>"$file.lock"
  flock "$lock"
  if [[ -f $file ]]; then
    since=(-z "$file")
  fi
  temp=$(mktemp "$file.XXXXXX") || die "Could not create a temp file in $dir."
  # Abort a stall, not a slow host: downloads.percona.com can run at ~250 KB/s.
  if curl -fsSL --connect-timeout 30 --speed-limit 51200 --speed-time 120 --retry 3 \
    "${since[@]}" -o "$temp" "$url" && [[ -s $temp ]]; then
    must mv -f "$temp" "$file"
  fi
  rm -f "$temp"
  [[ -f $file ]] || die "Could not download PMM Client from $url."
  printf '%s' "$file"
}

# Stdout: the pmm3-client repository CLIENT installs from
pmm_client_channel() {
  case $1 in
    3-dev-latest) printf experimental ;;
    pmm3-rc) printf testing ;;
    pmm3-latest | 3.*.*) printf release ;;
    *) die "CLIENT_VERSION '$1' is not a channel, a 3.x.y release or a tarball URL." ;;
  esac
}

# Install PMM Client in NODE: from TARBALL (a host path) when given, otherwise
# the CLIENT package -- a channel name or an exact 3.x.y release.
install_pmm_client() {
  local node=$1 client=$2 tarball=${3:-} deb install channel='' version='' codename
  if [[ -z $tarball ]]; then
    channel=$(pmm_client_channel "$client") || return 1
    [[ $client != 3.*.* ]] || version=$client
  fi
  if [[ -n $tarball ]]; then
    must docker cp "$tarball" "$node:/tmp/pmm-client.tar.gz"
    # shellcheck disable=SC2016 # expanded by the container's shell
    install='rm -rf /tmp/pmm-client && mkdir -p /tmp/pmm-client
      tar -xzf /tmp/pmm-client.tar.gz -C /tmp/pmm-client
      cd "$(dirname "$(find /tmp/pmm-client -type f -name install_tarball -print -quit)")"
      bash ./install_tarball'
  elif docker exec "$node" test -f /etc/debian_version; then
    # shellcheck disable=SC2016 # expanded by the container's shell
    codename=$(docker exec "$node" sh -c '. /etc/os-release; echo "$VERSION_CODENAME"') ||
      die "Could not read the release codename of $node."
    # The fetcher's verifying cache waits out repo.percona.com's publishing race.
    deb=$("$FRAMEWORK_DIR/lib/fetch_pmm_client_deb.sh" "${channel/release/main}" "$codename" /tmp/pmm-client-cache 1800 "$version") ||
      die "Could not fetch the PMM Client package for $node."
    must docker cp "$deb" "$node:/tmp/pmm-client.deb"
    install='apt-get install -y /tmp/pmm-client.deb'
  else
    # Upstream mysql images ship neither percona-release nor, on 5.7, microdnf,
    # and PXC 5.7's is too old to know the pmm3-client repo, so it is always
    # brought to the latest. mysql:5.7 is EL7, where yum would quietly install a
    # PMM 2 client instead.
    # shellcheck disable=SC2016 # expanded by the container's shell
    install='case $(. /etc/os-release; echo "$VERSION_ID") in
        7*) echo "PMM 3 Client packages are not published for EL7; use a tarball CLIENT_VERSION." >&2; exit 3 ;;
      esac
      pkg=yum; command -v microdnf >/dev/null && pkg=microdnf
      rpm -Uvh --replacepkgs https://repo.percona.com/yum/percona-release-latest.noarch.rpm
      '
    install+="percona-release enable-only pmm3-client $channel && \$pkg install -y pmm-client${version:+-$version}"
  fi
  retry_on "$PMM_REPO_ERRORS" 3 "PMM Client install on $node" \
    docker exec --user root "$node" sh -ceu "$install
    ln -sf /usr/local/percona/pmm/bin/pmm-admin /usr/local/bin/pmm-admin
    ln -sf /usr/local/percona/pmm/bin/pmm-agent /usr/local/bin/pmm-agent
    pmm-admin --version" >/dev/null
}

# Registers NODE and starts pmm-agent without systemd, logging to LOG for the
# tests. A separate AGENT_NODE sharing NODE's network keeps Nomad out of the
# database container.
# Usage: setup_pmm_agent NODE ENCRYPTED [LOG] [NODE_NAME] [AGENT_NODE]
setup_pmm_agent() {
  local node=$1 encrypted=$2 log=${3:-/var/log/pmm-agent.log} node_name=${4:-$1} agent_node=${5:-$1}
  local -a setup=(
    "--config-file=$PMM_AGENT_CONFIG"
    "--server-address=$PMM_SERVER_HOST:$PMM_SERVER_PORT"
    --server-insecure-tls
    "--metrics-mode=${METRICS_MODE:-auto}"
    --server-username=admin
    "--server-password=$(admin_password)"
    --force
  ) start=("--config-file=$PMM_AGENT_CONFIG")
  if [[ $(bool_string "$CLIENT_DEBUG") == true ]]; then
    setup+=(--debug)
  fi
  # Every container of an image inherits the image's /etc/machine-id, which
  # pmm-agent reports as the node's machine_id, so nodes must not share one.
  must docker exec --user root "$agent_node" sh -c 'tr -d - </proc/sys/kernel/random/uuid >/etc/machine-id'
  if [[ $encrypted == true ]]; then
    must docker exec --user root "$agent_node" openssl genpkey -algorithm RSA \
      -pkeyopt rsa_keygen_bits:4096 -aes256 -pass pass:testpass -out "$PMM_AGENT_KEY"
    setup+=('--custom-labels=role=pmm-client, encrypted=true, password=true')
    setup+=("--config-file-key-file=$PMM_AGENT_KEY" --config-file-key-password=testpass)
    start+=("--config-file-key-file=$PMM_AGENT_KEY" --config-file-key-password=testpass)
  fi
  retry_on "$PMM_TRANSIENT_ERRORS" 10 "pmm-agent setup on $node" \
    docker exec --user root "$agent_node" pmm-agent setup "${setup[@]}" "$node" container "$node_name" >/dev/null
  must docker exec --detach --user root "$agent_node" sh -c "exec pmm-agent ${start[*]} >>'$log' 2>&1"
}

pmm_agent_connected() {
  local status
  status=$(docker exec "$1" pmm-admin status 2>&1) || return 1
  [[ $status =~ Connected[[:space:]]*:[[:space:]]*true ]]
}

wait_pmm_agent() {
  retry 60 "pmm-agent on $1 to connect" pmm_agent_connected "$1" >/dev/null
}

# Retries while a freshly set up agent is not connected yet.
# Usage: pmm_register NODE pmm-admin add TYPE ARGS...
pmm_register() {
  local node=$1
  shift
  retry_on 'pmm-agent is not connected|context deadline exceeded' 60 "registering on $node" \
    docker exec "$node" "$@" >/dev/null
}

# NODE_NAME defaults to NODE plus the nightly shard, so shards sharing one
# server keep their nodes apart.
# Usage: attach_pmm_client NODE CLIENT TARBALL PMM_AGENT_LOG [NODE_NAME]
attach_pmm_client() {
  step 'Wait for PMM Server' wait_pmm_server_ready
  step 'Install PMM Client' install_pmm_client "$1" "$2" "$3"
  step 'Set up PMM agent' setup_pmm_agent "$1" false "$4" "${5:-$1${SHARD_NAME:+-$SHARD_NAME}}"
  step 'Wait for pmm-agent' wait_pmm_agent "$1"
}

# Usage: exporter_running NODE EXPORTER [STATES]  (STATES defaults to running|waiting)
exporter_running() {
  local status
  status=$(docker exec "$1" pmm-admin status 2>&1) || return 1
  grep -Eiq "$2.*(${3:-running|waiting})" <<<"$status"
}

# Wait for each EXPORTER to be running or waiting, then for node_exporter to be
# Running: host dashboards read node_exporter, so a node without it has no CPU,
# memory or network data even when its database exporters are fine.
# Usage: wait_exporters NODE PMM_AGENT_LOG [EXPORTER...]
wait_exporters() {
  local exporter
  for exporter in "${@:3}"; do
    retry 60 "$exporter on $1" exporter_running "$1" "$exporter" >/dev/null
  done
  if ! (retry 60 "node_exporter on $1 to be Running" exporter_running "$1" node_exporter running >/dev/null); then
    docker exec "$1" sh -c "grep -i node_exporter '$2' | tail -20" >&2 || true
    die "node_exporter is not running on $1."
  fi
}

# Print each NODE's agents and their states as `agent-status NODE: ...` lines,
# which the parallel runner echoes even for a setup that succeeded.
report_agent_status() {
  local node
  for node; do
    docker exec "$node" pmm-admin status 2>&1 | grep -Ei 'exporter|vmagent|agent_' | sed "s/^[[:space:]]*/agent-status $node: /" || true
  done
}
