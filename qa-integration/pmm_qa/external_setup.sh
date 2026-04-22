#!/bin/sh


while [ $# -gt 0 ]; do

   if [[ $1 == *"--"* ]]; then
        param="${1/--/}"
        declare $param="$2"
   fi

  shift
done

if [ -z "$metrics_mode" ]
then
      export metrics_mode=push
fi

if [ -z "$setup_version" ]
then
      export setup_version="1.14.0"
fi

if [ -z "$setup_type" ]
then
      export setup_type=redis
fi

# Install the dependencies
source ~/.bash_profile || true;
apt-get update
apt-get -y install wget curl git gnupg2 lsb-release
apt-get -y install -y git ca-certificates gcc libc6-dev liblua5.3-dev libpcre3-dev libssl-dev libsystemd-dev make wget zlib1g-dev

if [[ "$setup_type" == "redis" ]]; then
    wget https://github.com/oliver006/redis_exporter/releases/download/v${setup_version}/redis_exporter-v${setup_version}.linux-386.tar.gz
    tar -xvf redis_exporter-v${setup_version}.linux-386.tar.gz
    sleep 10
    rm redis_exporter*.tar.gz
    mv redis_exporter-* redis_exporter || exit
elif [[ "$setup_type" == "nodeprocess" ]]; then
    wget https://github.com/ncabatoff/process-exporter/releases/download/v${setup_version}/process-exporter-${setup_version}.linux-amd64.tar.gz
    tar -xvf process-exporter-${setup_version}.linux-amd64.tar.gz || exit
    sleep 10
    rm process-exporter*.tar.gz
    mv process-exporter-* process-exporter || exit
fi


