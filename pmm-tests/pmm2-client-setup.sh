#!/bin/sh

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

apt-get update
apt-get install -y wget gnupg2 libtinfo-dev libnuma-dev mysql-client postgresql-client
wget https://repo.percona.com/apt/percona-release_latest.$(lsb_release -sc)_all.deb
dpkg -i percona-release_latest.$(lsb_release -sc)_all.deb
apt-get update
export PMM_AGENT_SETUP_NODE_NAME=client_container_$(echo $((1 + $RANDOM % 9999)))
mv -v /artifacts/* .

if [[ "$client_version" == "dev-latest" ]]; then
    percona-release enable-only original experimental
    apt-get update
    apt-get -y install pmm2-client
fi

if [[ "$client_version" == "pmm2-rc" ]]; then
    percona-release enable-only original testing
    apt-get update
    apt-get -y install pmm2-client
fi

if [[ "$client_version" == "pmm2-latest" ]]; then
    apt-get -y install pmm2-client
    apt-get -y update
    percona-release enable-only original experimental
fi

## only supported for debian based systems for now
if [[ "$client_version" == 2* ]]; then
 wget -O pmm2-client.deb https://repo.percona.com/pmm2-client/apt/pool/main/p/pmm2-client/pmm2-client_${client_version}-6.$(lsb_release -sc)_amd64.deb
 dpkg -i pmm2-client.deb
fi

## Default Binary path
path="/usr/local/percona/pmm2";
## As export PATH is not working link the paths
ln -sf ${path}/bin/pmm-admin /usr/local/bin/pmm-admin
ln -sf ${path}/bin/pmm-agent /usr/local/bin/pmm-agent

if [[ "$client_version" == http* ]]; then
    if [[ "$install_client" == "yes" ]]; then
       wget -O pmm2-client.tar.gz --progress=dot:giga "${client_version}"
    fi
    tar -zxpf pmm2-client.tar.gz
    rm -r pmm2-client.tar.gz
    PMM2_CLIENT=`ls -1td pmm2-client* 2>/dev/null | grep -v ".tar" | grep -v ".sh" | head -n1`
    echo ${PMM2_CLIENT}
    rm -rf pmm2-client
    mv ${PMM2_CLIENT} pmm2-client
    rm -rf /usr/local/bin/pmm2-client
    mv -f pmm2-client /usr/local/bin
    pushd /usr/local/bin/pmm2-client
    ## only setting up all binaries in default path /usr/local/percona/pmm2
    bash -x ./install_tarball ${upgrade}
    pwd
    popd
    pmm-admin --version
fi    

## Check if we are upgrading or attempting fresh install.
if [[ -z "$upgrade" ]]; then
    if [[ "$use_metrics_mode" == "yes" ]]; then
        echo "setup pmm-agent"
        pmm-agent setup --config-file=/usr/local/percona/pmm2/config/pmm-agent.yaml --server-address=${pmm_server_ip}:443 --server-insecure-tls --metrics-mode=${metrics_mode} --server-username=admin --server-password=${admin_password}
    else 
        echo "setup pmm-agent"
        pmm-agent setup --config-file=/usr/local/percona/pmm2/config/pmm-agent.yaml --server-address=${pmm_server_ip}:443 --server-insecure-tls --server-username=admin --server-password=${admin_password}
    fi    
    sleep 10
    pmm-agent --config-file=/usr/local/percona/pmm2/config/pmm-agent.yaml > pmm-agent.log 2>&1 &
    sleep 10
else    
   pid=`ps -ef | grep pmm-agent | grep -v grep | awk -F ' ' '{print $2}'`
   if [[ ! -z "$pid" ]]; then
       kill -9 $pid
       echo "killed old agent, restarting agent...."
       pmm-agent --config-file=/usr/local/percona/pmm2/config/pmm-agent.yaml > pmm-agent.log 2>&1 &
       sleep 10
   fi
fi
echo "pmm-admin status"
pmm-admin status
