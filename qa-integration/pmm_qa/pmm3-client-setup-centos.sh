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
if [[  "$pmm_server_ip" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  port=443
fi

microdnf install -y wget gnupg2 jq
wget https://repo.percona.com/yum/percona-release-latest.noarch.rpm
rpm -i ./percona-release-latest.noarch.rpm
export PMM_AGENT_SETUP_NODE_NAME=client_container_$(echo $((1 + $RANDOM % 9999)))

if [[ "$client_version" == "3-dev-latest" ]]; then
    echo "Installing 3-dev-latest pmm client"
    percona-release enable-only pmm3-client experimental
    microdnf install -y pmm-client
fi

if [[ "$client_version" == "pmm3-rc" ]]; then
    echo "Installing testing pmm client"
    percona-release enable-only pmm3-client testing
    microdnf install -y pmm-client
fi

if [[ "$client_version" == "pmm3-latest" ]]; then
    echo "Installing release pmm client"
    microdnf -y install pmm-client
fi

if [[ "$client_version" =~ ^3\.[0-9]+\.[0-9]+$ ]]; then
  wget -O pmm-client.deb https://repo.percona.com/pmm3-client/yum/release/9/RPMS/x86_64/pmm-client-${client_version}-7.el9.x86_64.rpm
  rpm -i pmm-client.deb
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
        echo "setup pmm-agent when metrics mode yes"
        pmm-agent setup --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml --server-address=${pmm_server_ip}:${port} --server-insecure-tls --metrics-mode=${metrics_mode} --server-username=admin --server-password=${admin_password}
    else 
        echo "setup pmm-agent when metrics mode no"
        pmm-agent setup --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml --server-address=${pmm_server_ip}:${port} --server-insecure-tls --server-username=admin --server-password=${admin_password}
    fi    
    sleep 10
    pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml > pmm-agent.log 2>&1 &
    sleep 10
else    
   pid=`ps -ef | grep pmm-agent | grep -v grep | awk -F ' ' '{print $2}'`
   if [ -n "$pid" ]; then
       kill -9 $pid
       echo "Killing and restarting pmm agent...."
       pmm-agent --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml >> pmm-agent.log 2>&1 &
       sleep 10
   fi
fi
echo "pmm-admin status"
pmm-admin status
