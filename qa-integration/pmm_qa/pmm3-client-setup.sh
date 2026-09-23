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
export PMM_AGENT_SETUP_NODE_NAME=${PMM_AGENT_SETUP_NODE_NAME:-client_container_$((1 + $RANDOM % 9999))}
PMM_AGENT_SETUP_NODE_NAME=$(printf '%s' "$PMM_AGENT_SETUP_NODE_NAME" | tr -c 'A-Za-z0-9_-' '_')
export PMM_AGENT_SETUP_NODE_NAME
mv -v /artifacts/* .

# One verified package per version: staged into containers by the playbooks,
# or fetched through the host cache that CI restores. Empty when neither is
# available, and the caller downloads it itself as before.
cached_pmm_client_deb() {
    local component=$1 version=${2:-} fetcher cache_dir=/tmp/pmm-client-cache deb
    if [ -s /pmm-client.deb ]; then
        echo /pmm-client.deb
        return 0
    fi
    fetcher="$(dirname "$0")/scripts/fetch-pmm-client-deb.sh"
    [ -x "$fetcher" ] || return 0
    # Fits inside the tightest caller's 19m wall, so a give-up prints its diagnosis.
    deb=$("$fetcher" "$component" "$(lsb_release -sc)" "$cache_dir" 900 "$version") || return 0
    # Root owns the tree, but the cache action has to read it and the later
    # non-root pmm-framework run has to reopen the fetcher's lock inside it.
    chmod -R a+rwX "$cache_dir"
    echo "$deb"
}

install_pmm_client_from_repo() {
    local component=$1 index_component=$1 attempt deb
    [ "$component" = release ] && index_component=main
    percona-release enable-only pmm3-client "$component"
    deb=$(cached_pmm_client_deb "$index_component")
    # dpkg, not apt: apt swaps a local .deb for the repository's copy when
    # the versions match, and downloads it again.
    if [ -n "$deb" ]; then
        dpkg -i "$deb" || { apt-get update && apt-get -y -f install; }
        dpkg-query -W pmm-client >/dev/null 2>&1 && return 0
    fi
    for attempt in 1 2 3 4 5; do
        apt-get update
        apt-get -y install pmm-client && return 0
        echo "pmm-client install failed (attempt $attempt/5); retrying in 90s..." >&2
        sleep 90
    done
    return 1
}

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
  deb_file=$(cached_pmm_client_deb main "$client_version")
  if [ -z "$deb_file" ]; then
    build_number=7
    minor_version=${client_version#3.}
    minor_version=${minor_version%%.*}
    if [ "$client_version" = "3.7.1" ] || [ "$client_version" = "3.8.0" ]; then
      build_number=8
    elif [ "$client_version" = "3.8.1" ] || [ "$minor_version" -gt 8 ]; then
      build_number=1
    fi
    deb_file="pmm-client_${client_version}-${build_number}.$(lsb_release -sc)_$(dpkg --print-architecture).deb"
    wget --continue --timeout=60 --waitretry=15 --progress=dot:giga \
      -O "${deb_file}" "https://repo.percona.com/pmm3-client/apt/pool/main/p/pmm-client/${deb_file}"
  fi
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
