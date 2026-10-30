#!/bin/bash

echo "start installing pmm-agent"

while [ $# -gt 0 ]; do

   if [[ $1 == *"--"* ]]; then
        param="${1/--/}"
        declare $param="$2"
   fi

  shift
done

if [ -z "$admin_password" ]; then
    export admin_password=admin
fi

if [ -z "$pmm_server_ip" ]; then
    export pmm_server_ip=127.0.0.1
fi

if [ -z "$client_version" ]; then
    export client_version=latest-tarball
fi

if [ -z "$install_client" ]; then
    export install_client=yes
fi

if [ -z "$metrics_mode" ]; then
    export metrics_mode=auto
fi

if [ -z "$use_metrics_mode" ]; then
    export use_metrics_mode=yes
fi

if [ ! -z "$upgrade" ]; then
     upgrade="-u"
fi

DEBUG_FLAG=""
if [ ! -z "$debug" ]; then
    DEBUG_FLAG="--debug"
fi

port=8443
if [[  "$pmm_server_ip" =~ \. ]]; then
  port=443
fi

# The install branches below are bare `if`s with no else, so an unrecognised
# client_version would install nothing at all.
if ! [[ "$client_version" =~ ^(3-dev-latest|pmm3-rc|pmm3-latest|latest-tarball|3\.[0-9]+\.[0-9]+|https?://.*)$ ]]; then
    echo "ERROR: unrecognised client_version '$client_version'." >&2
    echo "Expected: 3-dev-latest, pmm3-rc, pmm3-latest, latest-tarball, an exact 3.x.y version, or an http(s) tarball URL." >&2
    exit 1
fi

apt-get update
apt-get install -y wget gnupg2 libtinfo-dev libnuma-dev mysql-client postgresql-client
wget "https://repo.percona.com/apt/percona-release_latest.$(lsb_release -sc)_all.deb"
dpkg -i "percona-release_latest.$(lsb_release -sc)_all.deb"
apt-get update
export PMM_AGENT_SETUP_NODE_NAME=${PMM_AGENT_SETUP_NODE_NAME:-client_container_$((1 + $RANDOM % 9999))}
PMM_AGENT_SETUP_NODE_NAME=$(printf '%s' "$PMM_AGENT_SETUP_NODE_NAME" | tr -c 'A-Za-z0-9_-' '_')
export PMM_AGENT_SETUP_NODE_NAME
mv -v /artifacts/* .

# Runs under sudo, so it keeps its own cache: a root-owned /tmp/pmm-client-cache
# would lock out pmm-framework, which runs unprivileged.
install_pmm_client_deb() {
    local component=$1 version=${2:-} deb
    deb=$(bash "$(dirname "$0")/pmm-framework/lib/fetch_pmm_client_deb.sh" \
        "$component" "$(lsb_release -sc)" /tmp/pmm-client-host-cache 900 "$version") &&
        apt-get install -y "$deb" && return 0
    echo "pmm-client could not be installed; aborting client setup" >&2
    exit 1
}

case "$client_version" in
    3-dev-latest)
        percona-release enable-only pmm3-client experimental
        install_pmm_client_deb experimental ;;
    pmm3-rc)
        percona-release enable-only pmm3-client testing
        install_pmm_client_deb testing ;;
    pmm3-latest)
        install_pmm_client_deb main
        percona-release enable-only pmm3-client experimental ;;
    3.*.*)
        install_pmm_client_deb main "$client_version" ;;
esac

lib="$(dirname "${BASH_SOURCE[0]}")/pmm-framework/lib"
client_version=$(bash -c 'source "$1/common.sh" && normalize_client_version "$2"' _ "$lib" "$client_version")

path="/usr/local/percona/pmm";
## As export PATH is not working link the paths
ln -sf ${path}/bin/pmm-admin /usr/local/bin/pmm-admin
ln -sf ${path}/bin/pmm-agent /usr/local/bin/pmm-agent

if [[ "$client_version" == http* ]]; then
    if [[ "$install_client" == "yes" ]]; then
       # Fetch into pmm-framework's cache as the calling user, so a later
       # pmm-framework run reuses this download instead of repeating it.
       tarball=$(${SUDO_USER:+sudo -H -u "$SUDO_USER"} bash -c \
         'source "$1/common.sh" && source "$1/run_helpers.sh" && source "$1/pmm_client.sh" && fetch_client_tarball "$2"' _ "$lib" "$client_version") || exit 1
       cp "$tarball" pmm-client.tar.gz
    fi
    tar -zxpf pmm-client.tar.gz
    rm -r pmm-client.tar.gz
    PMM_CLIENT=$(ls -1td pmm-client*/ 2>/dev/null | head -n1)
    echo ${PMM_CLIENT}
    rm -rf pmm-client
    mv ${PMM_CLIENT} pmm-client
    rm -rf /usr/local/bin/pmm-client
    mv -f pmm-client /usr/local/bin
    pushd /usr/local/bin/pmm-client || exit 1
    bash -x ./install_tarball ${upgrade}
    pwd
    popd || exit 1
    pmm-admin --version
fi

# The CLI tests start by expecting a Running agent, which comes a few seconds after Connected.
wait_pmm_agent_connected() {
    local status
    for _ in $(seq 1 60); do
        status=$(pmm-admin status 2>/dev/null)
        grep -Eq 'Connected[[:space:]]*:[[:space:]]*true' <<<"$status" && grep -q Running <<<"$status" && return 0
        sleep 1
    done
    echo "pmm-agent had no Running agent within 60s" >&2
}

if [[ -z "$upgrade" ]]; then
    metrics_flag=""
    if [[ "$use_metrics_mode" == "yes" ]]; then
        metrics_flag="--metrics-mode=${metrics_mode}"
    fi
    for i in 1 2 3; do
        echo "setup pmm-agent (attempt $i/3)"
        pmm-agent setup --force --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml --server-address=${pmm_server_ip}:${port} --server-insecure-tls $DEBUG_FLAG $metrics_flag --server-username=admin --server-password=${admin_password} && break
        [[ $i == 3 ]] || { echo "pmm-agent setup failed (attempt $i/3); retrying in 30s..."; sleep 30; }
    done
    sleep 10
    pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml > pmm-agent.log 2>&1 &
    wait_pmm_agent_connected
else
   pid=$(pgrep -x pmm-agent)
   if [[ ! -z "$pid" ]]; then
       kill -9 $pid
       echo "Killing and restarting pmm agent...."
       pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml >> pmm-agent.log 2>&1 &
       wait_pmm_agent_connected
   fi
fi
echo "pmm-admin version"
pmm-admin version

echo "pmm-admin status"
pmm-admin status
