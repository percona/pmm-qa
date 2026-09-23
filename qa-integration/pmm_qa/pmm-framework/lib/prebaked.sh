#!/usr/bin/env bash
#
# lib/prebaked.sh -- the docker backend: provision on a prebaked image with
# plain docker commands, instead of handing an env map to a playbook.
#
# A sequential setup runs inside `(run_database_spec) || status=$?`, where bash
# ignores `set -e` for everything underneath. So nothing here relies on
# errexit: every helper dies on its own failure.

readonly PMM_AGENT_CONFIG=/usr/local/percona/pmm/config/pmm-agent.yaml
readonly PMM_AGENT_KEY=/usr/local/percona/pmm/config/pmm-key.pem
readonly PMM_REPO_ERRORS='mirrors were tried|inconsistent server data|curl error|could not resolve|timed out|status code: 5'
readonly PMM_TRANSIENT_ERRORS='connection refused|connection reset|no such host|timeout|timed out|eof|handshake|internal server error|50[0234]'

# Run a command, dying if it fails. Only the first words are echoed, so a
# password further along the command line stays out of the log.
must() {
  "$@" || die "Command failed: ${*:1:4}"
}

# Run a command under a timed ==>/<== banner.
step() {
  local description=$1 start=${EPOCHREALTIME/./} tenths
  shift
  log_info "==> $description"
  "$@" || die "$description failed."
  tenths=$(((${EPOCHREALTIME/./} - start) / 100000))
  log_info "<== $description ($((tenths / 10)).$((tenths % 10))s)"
}

# Rerun a command once a second, up to ATTEMPTS times, for as long as its
# output matches PATTERN (case-insensitive; '' retries any failure).
# Stdout: the output of the attempt that succeeded
# Usage:  retry_on 'not connected' 60 'registering node1' docker exec ...
retry_on() {
  local pattern=$1 attempts=$2 description=$3 attempt output=''
  shift 3
  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if output=$("$@" 2>&1); then
      printf '%s' "$output"
      return 0
    fi
    [[ ${output,,} =~ $pattern ]] || break
    sleep 1
  done
  # ${output: -400} is empty, not whole, when the output is shorter than that.
  if ((${#output} > 400)); then
    output=${output: -400}
  fi
  die "Gave up on $description after $((attempt > attempts ? attempts : attempt)) attempt(s); last output: $output"
}

# Usage: retry ATTEMPTS DESCRIPTION CMD...
retry() {
  retry_on '' "$@"
}

# Run FN NODE ARGS... for every node in the array named NODES_NAME at once.
# Usage: each_node names install_pmm_client "$client"
each_node() {
  local -n nodes_ref=$1
  local fn=$2 node pid failed=0
  local -a pids=()
  shift 2
  for node in "${nodes_ref[@]}"; do
    "$fn" "$node" "$@" &
    pids+=("$!")
  done
  for pid in "${pids[@]}"; do
    wait "$pid" || failed=$((failed + 1))
  done
  ((failed == 0)) || die "$fn failed on $failed of ${#pids[@]} node(s)."
}

ensure_pmm_network() {
  if ! docker network inspect pmm-qa >/dev/null 2>&1; then
    must docker network create pmm-qa >/dev/null
  fi
}

# Only a discovered local server can be probed; an --pmm-server-ip is trusted.
wait_pmm_server_ready() {
  [[ -n $PMM_SERVER_CONTAINER ]] || return 0
  retry 180 'PMM Server readiness' \
    docker exec "$PMM_SERVER_CONTAINER" curl -fsS http://127.0.0.1:8080/v1/server/readyz >/dev/null
}

# Download a PMM Client tarball once per URL, revalidating the cached copy with
# If-Modified-Since. An unreachable build cache falls back to the cached copy.
# Stdout: the path of the cached tarball
fetch_client_tarball() {
  local url=$1 dir=${XDG_CACHE_HOME:-$HOME/.cache}/pmm-framework file
  local -a since=()
  file=$dir/pmm-client-$(printf '%s' "$url" | sha256sum | cut -c1-16).tar.gz
  must mkdir -p "$dir"
  if [[ -f $file ]]; then
    since=(-z "$file")
  fi
  if curl -fsSL "${since[@]}" -o "$file.$$" "$url" && [[ -s $file.$$ ]]; then
    must mv -f "$file.$$" "$file"
  fi
  rm -f "$file.$$"
  [[ -f $file ]] || die "Could not download PMM Client from $url."
  printf '%s' "$file"
}

# Install PMM Client in NODE: from TARBALL (a host path) when given, otherwise
# the CLIENT package -- a channel name or an exact 3.x.y release.
install_pmm_client() {
  local node=$1 client=$2 tarball=${3:-} install minor build=7
  if [[ -n $tarball ]]; then
    must docker cp "$tarball" "$node:/tmp/pmm-client.tar.gz"
    # shellcheck disable=SC2016 # expanded by the container's shell
    install='rm -rf /tmp/pmm-client && mkdir -p /tmp/pmm-client
      tar -xzf /tmp/pmm-client.tar.gz -C /tmp/pmm-client
      cd "$(dirname "$(find /tmp/pmm-client -type f -name install_tarball -print -quit)")"
      bash ./install_tarball'
  else
    # Upstream mysql images ship neither percona-release nor, on 5.7, microdnf.
    # mysql:5.7 is EL7, where yum would quietly install a PMM 2 client instead.
    # shellcheck disable=SC2016 # expanded by the container's shell
    install='case $(. /etc/os-release; echo "$VERSION_ID") in
        7*) echo "PMM 3 Client packages are not published for EL7; use a tarball CLIENT_VERSION." >&2; exit 3 ;;
      esac
      pkg=yum; command -v microdnf >/dev/null && pkg=microdnf
      command -v percona-release >/dev/null ||
        rpm -Uvh https://repo.percona.com/yum/percona-release-latest.noarch.rpm
      '
    case $client in
      3-dev-latest) install+='percona-release enable-only pmm3-client experimental' ;;
      pmm3-rc) install+='percona-release enable-only pmm3-client testing' ;;
      pmm3-latest) install+='percona-release enable-only pmm3-client release' ;;
      3.*.*)
        minor=${client#3.}
        minor=${minor%%.*}
        if [[ $client == 3.7.1 || $client == 3.8.0 ]]; then
          build=8
        elif [[ $client == 3.8.1 ]] || ((minor > 8)); then
          build=1
        fi
        install+="os=\$(. /etc/os-release; echo \${VERSION_ID%%.*})
          curl -fL -o /tmp/pmm-client.rpm https://repo.percona.com/pmm3-client/yum/release/\$os/RPMS/x86_64/pmm-client-$client-$build.el\$os.x86_64.rpm
          \$pkg install -y /tmp/pmm-client.rpm"
        ;;
      *) die "CLIENT_VERSION '$client' is not a channel, a 3.x.y release or a tarball URL." ;;
    esac
    if [[ $client != 3.*.* ]]; then
      # shellcheck disable=SC2016 # expanded by the container's shell
      install+=' && $pkg install -y pmm-client'
    fi
  fi
  retry_on "$PMM_REPO_ERRORS" 3 "PMM Client install on $node" \
    docker exec --user root "$node" sh -ceu "$install
    ln -sf /usr/local/percona/pmm/bin/pmm-admin /usr/local/bin/pmm-admin
    ln -sf /usr/local/percona/pmm/bin/pmm-agent /usr/local/bin/pmm-agent
    pmm-admin --version" >/dev/null
}

# Register NODE's pmm-agent with the server and start it without systemd.
# ENCRYPTED=true stores the agent config encrypted, as ENCRYPTED_CLIENT_CONFIG asks.
setup_pmm_agent() {
  local node=$1 encrypted=$2
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
  if [[ $encrypted == true ]]; then
    must docker exec --user root "$node" openssl genpkey -algorithm RSA \
      -pkeyopt rsa_keygen_bits:4096 -aes256 -pass pass:testpass -out "$PMM_AGENT_KEY"
    setup+=('--custom-labels=role=pmm-client, encrypted=true, password=true')
    setup+=("--config-file-key-file=$PMM_AGENT_KEY" --config-file-key-password=testpass)
    start+=("--config-file-key-file=$PMM_AGENT_KEY" --config-file-key-password=testpass)
  fi
  retry_on "$PMM_TRANSIENT_ERRORS" 10 "pmm-agent setup on $node" \
    docker exec --user root "$node" pmm-agent setup "${setup[@]}" "$node" >/dev/null
  must docker exec --detach --user root "$node" pmm-agent "${start[@]}"
}

pmm_agent_connected() {
  local status
  status=$(docker exec "$1" pmm-admin status 2>&1) || return 1
  [[ $status =~ Connected[[:space:]]*:[[:space:]]*true ]]
}

wait_pmm_agent() {
  retry 60 "pmm-agent on $1 to connect" pmm_agent_connected "$1" >/dev/null
}

# Usage: wait_exporter NODE mysqld_exporter
wait_exporter() {
  retry 60 "$2 on $1" exporter_running "$1" "$2" >/dev/null
}

exporter_running() {
  local status
  status=$(docker exec "$1" pmm-admin status 2>&1) || return 1
  grep -Eiq "$2.*(running|waiting)" <<<"$status"
}
