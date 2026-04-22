#!/bin/sh

while [ $# -gt 0 ]; do
   if [[ $1 == *"--"* ]]; then
        param="${1/--/}"
        declare $param="$2"
   fi
  shift
done

if [ -z "$mongodb_version" ]; then
  export mongodb_version=7.0
fi

if [ -z "$mongdb_setup" ]; then
  export mongdb_setup=pss
fi

if [ -z "$metrics_mode" ]; then
  export metrics_mode=push
fi

# Mongo user credtials for the replicat set cluster
export user="dba"
export pwd="test1234"

# Install the dependencies
source ~/.bash_profile || true;
apt-get update
apt-get -y install wget curl jq git gnupg2 lsb-release
apt-get -y install libreadline6-dev systemtap-sdt-dev zlib1g-dev libssl-dev libpam0g-dev python-dev bison make flex libipc-run-perl
sleep 10

#wget https://raw.githubusercontent.com/Percona-QA/percona-qa/master/mongo_startup.sh
#chmod +x mongo_startup.sh
export SERVICE_RANDOM_NUMBER=$(echo $((1 + $RANDOM % 9999)))

## Detect latest tarball link for specified mongodb_version: 7.0 | 6.0 | 5.0 | 4.4 | 4.2 at the moment
modb_tarball=$(curl -s "https://www.mongodb.com/try/download/community" | \
  grep -oP "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2004-${mongodb_version//./\\.}\.\d+\.tgz" | \
  sort -V | tail -n 1)

echo "Downloading ${mongodb_version} from ${modb_tarball}..."
wget -O percona_server_mongodb.tar.gz ${modb_tarball}
tar -xvf percona_server_mongodb.tar.gz

export extracted_folder_name=$(ls | grep mongodb-linux)
echo "Extracted folder name ${extracted_folder_name}"
mv ${extracted_folder_name} modb_${mongodb_version}
rm percona_server_mongodb.tar.gz*

# For mongodb dependency in Debian
wget http://http.us.debian.org/debian/pool/main/o/openldap/libldap-2.4-2_2.4.47+dfsg-3+deb10u7_amd64.deb
apt install -y ./libldap-2.4-2_2.4.47+dfsg-3+deb10u7_amd64.deb

if [ "$mongodb_setup" == "pss" ]; then
    mlaunch init --bind_ip 0.0.0.0 --binarypath "./modb_${mongodb_version}/bin" --replicaset --name rs1 --nodes 3
    sleep 20
    pmm-admin remove mongodb mongodb_rs1_1_${SERVICE_RANDOM_NUMBER} || true; pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node --metrics-mode=$metrics_mode mongodb_rs1_1_${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:27017
    sleep 2
    pmm-admin remove mongodb mongodb_rs1_2_${SERVICE_RANDOM_NUMBER} || true; pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node --metrics-mode=$metrics_mode mongodb_rs1_2_${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:27018
    sleep 2
    pmm-admin remove mongodb mongodb_rs1_3_${SERVICE_RANDOM_NUMBER} || true; pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node --metrics-mode=$metrics_mode mongodb_rs1_3_${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:27019
    sleep 20
fi

if [ "$mongodb_setup" == "psa" ]; then
    mlaunch init --bind_ip 0.0.0.0 --binarypath "./modb_${mongodb_version}/bin" --replicaset --name rs1 --nodes 2 --arbiter
    sleep 20
    pmm-admin remove mongodb mongodb_rs1_1_${SERVICE_RANDOM_NUMBER} || true; pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node --metrics-mode=$metrics_mode mongodb_rs1_1_${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:27017
    sleep 2
    pmm-admin remove mongodb mongodb_rs1_2_${SERVICE_RANDOM_NUMBER} || true; pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node --metrics-mode=$metrics_mode mongodb_rs1_2_${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:27018
    sleep 2
    pmm-admin remove mongodb mongodb_rs1_3_${SERVICE_RANDOM_NUMBER} || true; pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node --metrics-mode=$metrics_mode mongodb_rs1_3_${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:27019
    sleep 20
fi

if [ "$mongodb_setup" == "sharded" ] || [ "$mongodb_setup" == "shards" ]; then
    mlaunch init --bind_ip 0.0.0.0 --binarypath "./modb_${mongodb_version}/bin" --replicaset --sharded rs1 rs2 --config 3
    pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --environment=mongos_shraded_node mongos_shraded_node_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27017
    sleep 2
    pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=config --environment=mongodb_config_node mongodb_config_1_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27024
    sleep 2
    pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=config --environment=mongodb_config_node mongodb_config_2_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27025
    sleep 2
    pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=config --environment=mongodb_config_node mongodb_config_3_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27026
    sleep 2
    pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node mongodb_rs1_1_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27018
    sleep 2
    pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node mongodb_rs1_2_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27019
    sleep 2
    pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node mongodb_rs1_3_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27020
    sleep 2
    pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=rs2 --environment=mongodb_rs_node mongodb_rs2_1_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27021
    sleep 2
    pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=rs2 --environment=mongodb_rs_node mongodb_rs2_2_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27022
    sleep 2
    pmm-admin add mongodb --enable-all-collectors --cluster mongodb_node_cluster --replication-set=rs2 --environment=mongodb_rs_node mongodb_rs2_3_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27023
    sleep 20
fi
