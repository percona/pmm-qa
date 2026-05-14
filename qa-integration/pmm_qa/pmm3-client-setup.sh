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
    export client_version=dev-latest
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

port=8443
if [[  "$pmm_server_ip" =~ \. ]]; then
  port=443
fi

apt-get update
apt-get install -y wget gnupg2 libtinfo-dev libnuma-dev mysql-client postgresql-client
wget https://repo.percona.com/apt/percona-release_latest.$(lsb_release -sc)_all.deb
dpkg -i percona-release_latest.$(lsb_release -sc)_all.deb
apt-get update
export PMM_AGENT_SETUP_NODE_NAME=client_container_$(echo $((1 + $RANDOM % 9999)))
mv -v /artifacts/* .

# Percona's CDN/repo occasionally serves inconsistent metadata during builds,
# which makes apt-get abort. The mismatch usually clears within a minute, so retry.
retry_apt_install() {
    local n=3
    local i
    for i in $(seq 1 $n); do
        apt-get -y install "$@" && return 0
        echo "apt-get install failed (attempt $i/$n); retrying in 30s..." >&2
        [ "$i" -lt "$n" ] || break
        sleep 30
        apt-get update
    done
    echo "apt-get install failed after $n attempts" >&2
    return 1
}

if [[ "$client_version" == "3-dev-latest" ]]; then
    percona-release enable-only pmm3-client experimental
    apt-get update
    retry_apt_install pmm-client
fi

if [[ "$client_version" == "pmm3-rc" ]]; then
    percona-release enable-only pmm3-client testing
    apt-get update
    retry_apt_install pmm-client
fi

if [[ "$client_version" == "pmm3-latest" ]]; then
    percona-release enable-only pmm3-client release
    retry_apt_install pmm-client
    apt-get -y update
    percona-release enable-only pmm3-client experimental
fi

if [[ "$client_version" == "latest-tarball" ]]; then
    client_version="https://pmm-build-cache.s3.us-east-2.amazonaws.com/PR-BUILDS/pmm-client/pmm-client-latest.tar.gz"
fi

## Only supported for debian based systems for now
if [[ "$client_version" =~ ^3\.[0-9]+\.[0-9]+$ ]]; then
  wget -O pmm-client.deb https://repo.percona.com/pmm3-client/apt/pool/main/p/pmm-client/pmm-client_${client_version}-7.$(lsb_release -sc)_amd64.deb
  dpkg -i pmm-client.deb
fi

## Default Binary path
path="/usr/local/percona/pmm";
## As export PATH is not working link the paths
ln -sf ${path}/bin/pmm-admin /usr/local/bin/pmm-admin
ln -sf ${path}/bin/pmm-agent /usr/local/bin/pmm-agent

if [[ "$client_version" == http* ]]; then
    if [[ "$install_client" == "yes" ]]; then
       wget -O pmm-client.tar.gz --progress=dot:giga "${client_version}"
    fi
    tar -zxpf pmm-client.tar.gz
    rm -r pmm-client.tar.gz
    PMM_CLIENT=`ls -1td pmm-client* 2>/dev/null | grep -v ".tar" | grep -v ".sh" | head -n1`
    echo ${PMM_CLIENT}
    rm -rf pmm-client
    mv ${PMM_CLIENT} pmm-client
    rm -rf /usr/local/bin/pmm-client
    mv -f pmm-client /usr/local/bin
    pushd /usr/local/bin/pmm-client
    ## only setting up all binaries in default path /usr/local/percona/pmm
    bash -x ./install_tarball ${upgrade}
    pwd
    popd
    pmm-admin --version
fi

## Check if we are upgrading or attempting fresh install.
if [[ -z "$upgrade" ]]; then
    if [[ "$use_metrics_mode" == "yes" ]]; then
        echo "setup pmm-agent"
        pmm-agent setup --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml --server-address=${pmm_server_ip}:${port} --server-insecure-tls --metrics-mode=${metrics_mode} --server-username=admin --server-password=${admin_password}
    else
        echo "setup pmm-agent"
        pmm-agent setup --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml --server-address=${pmm_server_ip}:${port} --server-insecure-tls --server-username=admin --server-password=${admin_password}
    fi
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
