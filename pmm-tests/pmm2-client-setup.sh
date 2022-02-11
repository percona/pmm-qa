#!/bin/sh

export PMM_SERVER_IP=$1
export CLIENT_VERSION=$2
export METRICS_METHOD=$3
export ADMIN_PASSWORD=$4
export INSTALL_CLIENT=$5

apt-get update
apt-get install -y wget gnupg2 libtinfo-dev libnuma-dev mysql-client postgresql-client
wget https://repo.percona.com/apt/percona-release_latest.$(lsb_release -sc)_all.deb
dpkg -i percona-release_latest.$(lsb_release -sc)_all.deb
apt-get update
export PMM_AGENT_SETUP_NODE_NAME=client_container_$(echo $((1 + $RANDOM % 9999)))
mv -v /artifacts/* .

if [[ "$CLIENT_VERSION" == "dev-latest" ]]; then
    percona-release enable-only original experimental
    apt-get update
    apt-get -y install pmm2-client
fi

if [[ "$CLIENT_VERSION" == "pmm2-rc" ]]; then
    percona-release enable-only original testing
    apt-get update
    apt-get -y install pmm2-client
fi

if [[ "$CLIENT_VERSION" == "pmm2-latest" ]]; then
    apt-get -y install pmm2-client
    apt-get -y update
    percona-release enable-only original experimental
fi

if [[ "$CLIENT_VERSION" == http* ]]; then
		if [[ "$INSTALL_CLIENT" == "yes" ]]; then
			wget -O pmm2-client.tar.gz --progress=dot:giga "${CLIENT_VERSION}"
		fi
        tar -zxpf pmm2-client.tar.gz
        rm -r pmm2-client.tar.gz
        export PMM2_CLIENT=`ls -1td pmm2-client* 2>/dev/null | grep -v ".tar" | grep -v ".sh" | head -n1`
        echo ${PMM2_CLIENT}
        mv ${PMM2_CLIENT} pmm2-client
        cd pmm2-client
        bash -x ./install_tarball
        pwd
        cd ../
        export PMM_CLIENT_BASEDIR=`ls -1td pmm2-client 2>/dev/null | grep -v ".tar" | head -n1`
        export PATH="`pwd`/pmm2-client/bin:$PATH"
        echo "export PATH=`pwd`/pmm2-client/bin:$PATH" >> ~/.bash_profile
        source ~/.bash_profile
        pmm-admin --version
        pmm-agent setup --config-file=`pwd`/pmm2-client/config/pmm-agent.yaml --server-address=${PMM_SERVER_IP}:443 --server-insecure-tls --metrics-mode=${METRICS_METHOD} --server-username=admin --server-password=${ADMIN_PASSWORD}
		sleep 10
		pmm-agent --config-file=`pwd`/pmm2-client/config/pmm-agent.yaml > pmm-agent.log 2>&1 &
else
		pmm-agent setup --config-file=/usr/local/percona/pmm2/config/pmm-agent.yaml --server-address=${PMM_SERVER_IP}:443 --server-insecure-tls --metrics-mode=${METRICS_METHOD} --server-username=admin --server-password=${ADMIN_PASSWORD}
		sleep 10
		pmm-agent --config-file=/usr/local/percona/pmm2/config/pmm-agent.yaml > pmm-agent.log 2>&1 &
fi
sleep 10
pmm-admin status
