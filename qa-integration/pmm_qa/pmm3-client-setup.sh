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
    export client_version=3-dev-latest
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
# --force above: with a stable node name, re-provisioning the same container
# hits "Node with name ... already exists" and the setup fails.
#
# A random name per run means a re-provisioned container registers under a new
# node, and its old series keep the previous name alive in every dashboard
# filter built from label_values. Callers pass the container name instead.
export PMM_AGENT_SETUP_NODE_NAME=${PMM_AGENT_SETUP_NODE_NAME:-client_container_$((1 + $RANDOM % 9999))}
mv -v /artifacts/* .

# repo.percona.com publishes the apt index and the pool file non-atomically, and
# the two disagree for 6-8 minutes at a time (measured), not the minute the old
# three-attempt retry here assumed. This script is docker-cp'd into containers on
# its own, so it cannot call the host-side fetch helper -- keep retrying here, but
# over a span that can actually outlast a window.
install_pmm_client_from_repo() {
    local component=$1 attempt
    percona-release enable-only pmm3-client "$component"
    for attempt in 1 2 3 4 5; do
        apt-get update
        apt-get -y install pmm-client && return 0
        echo "pmm-client install failed (attempt $attempt/5); retrying in 90s..." >&2
        sleep 90
    done
    return 1
}

# Without this the script used to walk on after a failed install and only die
# later on a missing pmm-admin, reporting rc=127 instead of the real cause.
die_on_install_failure() {
    echo "pmm-client could not be installed; aborting client setup" >&2
    exit 1
}

if [[ "$client_version" == "3-dev-latest" ]]; then
    install_pmm_client_from_repo experimental || die_on_install_failure
fi

if [[ "$client_version" == "pmm3-rc" ]]; then
    install_pmm_client_from_repo testing || die_on_install_failure
fi

if [[ "$client_version" == "pmm3-latest" ]]; then
    install_pmm_client_from_repo release || die_on_install_failure
    apt-get -y update
    percona-release enable-only pmm3-client experimental
fi

if [[ "$client_version" == "latest-tarball" ]]; then
    # arm64 builds are published under their own bucket prefix.
    bucket=pmm-client
    case "$(dpkg --print-architecture)" in
      arm64) bucket=pmm-client-arm ;;
    esac
    client_version="https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/${bucket}/pmm-client-latest.tar.gz"
fi

## Only supported for debian based systems for now
if [[ "$client_version" =~ ^3\.[0-9]+\.[0-9]+$ ]]; then
  build_number=7
  minor_version=${client_version#3.}
  minor_version=${minor_version%%.*}
  if [ "$client_version" = "3.7.1" ] || [ "$client_version" = "3.8.0" ]; then
    build_number=8
  elif [ "$client_version" = "3.8.1" ] || [ "$minor_version" -gt 8 ]; then
    build_number=1
  fi
  # Deliberately not routed through scripts/fetch-pmm-client-deb.sh: this script
  # runs under sudo, so it would create /tmp/pmm-client-cache root-owned and the
  # Ansible client install, which runs as the build user and shares that cache,
  # could no longer write into it.
  deb_file="pmm-client_${client_version}-${build_number}.$(lsb_release -sc)_$(dpkg --print-architecture).deb"
  wget --continue --timeout=60 --waitretry=15 --progress=dot:giga \
    -O "${deb_file}" "https://repo.percona.com/pmm3-client/apt/pool/main/p/pmm-client/${deb_file}"
  dpkg -i "${deb_file}"
fi

## Default Binary path
path="/usr/local/percona/pmm";
## As export PATH is not working link the paths
ln -sf ${path}/bin/pmm-admin /usr/local/bin/pmm-admin
ln -sf ${path}/bin/pmm-agent /usr/local/bin/pmm-agent

if [[ "$client_version" == http* ]]; then
    if [[ "$install_client" == "yes" ]]; then
       wget -O pmm-client.tar.gz --progress=dot:giga \
         --timeout=60 --waitretry=15 "${client_version}"
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
    ## only setting up all binaries in default path /usr/local/percona/pmm
    bash -x ./install_tarball ${upgrade}
    pwd
    popd || exit 1
    pmm-admin --version
fi

## Check if we are upgrading or attempting fresh install.
if [[ -z "$upgrade" ]]; then
    retry_pmm_agent_setup() {
        local n=3
        local i
        for i in $(seq 1 $n); do
            if [[ "$use_metrics_mode" == "yes" ]]; then
                echo "setup pmm-agent (attempt $i/$n)"
                pmm-agent setup --force --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml --server-address=${pmm_server_ip}:${port} --server-insecure-tls $DEBUG_FLAG --metrics-mode=${metrics_mode} --server-username=admin --server-password=${admin_password} && return 0
            else
                echo "setup pmm-agent (attempt $i/$n)"
                pmm-agent setup --force --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml --server-address=${pmm_server_ip}:${port} --server-insecure-tls $DEBUG_FLAG --server-username=admin --server-password=${admin_password} && return 0
            fi
            echo "pmm-agent setup failed (attempt $i/$n); retrying in 30s..."
            sleep 30
        done
        return 1
    }
    retry_pmm_agent_setup
    sleep 10
    pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml > pmm-agent.log 2>&1 &
    sleep 10
else
   pid=`ps -ef | grep pmm-agent | grep -v grep | awk -F ' ' '{print $2}'`
   if [[ ! -z "$pid" ]]; then
       kill -9 $pid
       echo "Killing and restarting pmm agent...."
       pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml >> pmm-agent.log 2>&1 &
       sleep 10
   fi
fi
echo "pmm-admin version"
pmm-admin version

echo "pmm-admin status"
pmm-admin status
