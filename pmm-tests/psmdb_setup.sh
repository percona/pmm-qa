#!/bin/sh


while [ $# -gt 0 ]; do

   if [[ $1 == *"--"* ]]; then
        param="${1/--/}"
        declare $param="$2"
   fi

  shift
done

if [ -z "$mongodb_version" ]
then
      export mongodb_version=4.4
fi

if [ -z "$mongdb_setup" ]
then
      export mongdb_setup=replica
fi

if [ -z "$metrics_mode" ]
then
      export metrics_mode=push
fi

# Install the dependencies
source ~/.bash_profile || true;
apt-get update
apt-get -y install wget curl git gnupg2 lsb-release
apt-get -y install libreadline6-dev systemtap-sdt-dev zlib1g-dev libssl-dev libpam0g-dev python-dev bison make flex libipc-run-perl wget
sleep 10

wget https://repo.percona.com/apt/percona-release_latest.generic_all.deb
dpkg -i percona-release_latest.generic_all.deb
wget https://raw.githubusercontent.com/Percona-QA/percona-qa/master/mongo_startup.sh
chmod +x mongo_startup.sh
wget https://raw.githubusercontent.com/percona/pmm-qa/main/pmm-tests/mongodb_user_setup.js
export SERVICE_RANDOM_NUMBER=$(echo $((1 + $RANDOM % 9999)))

if [ "$mongodb_version" == "4.4" ]; then
   wget -O percona_server_mongodb.tar.gz https://downloads.percona.com/downloads/percona-server-mongodb-4.4/percona-server-mongodb-4.4.16-16/binary/tarball/percona-server-mongodb-4.4.16-16-x86_64.glibc2.17-minimal.tar.gz
fi

if [ "$mongodb_version" == "4.2" ]; then
   wget -O percona_server_mongodb.tar.gz https://downloads.percona.com/downloads/percona-server-mongodb-4.2/percona-server-mongodb-4.2.22-22/binary/tarball/percona-server-mongodb-4.2.22-22-x86_64.glibc2.17-minimal.tar.gz
fi

if [ "$mongodb_version" == "5.0" ]; then
   wget -O percona_server_mongodb.tar.gz https://downloads.percona.com/downloads/percona-server-mongodb-LATEST/percona-server-mongodb-5.0.11-10/binary/tarball/percona-server-mongodb-5.0.11-10-x86_64.glibc2.17-minimal.tar.gz
fi

tar -xvf percona_server_mongodb.tar.gz
rm percona_server_mongodb.tar.gz*
mv percona-server-mongodb-${mongodb_version}.* psmdb_${mongodb_version}

if [ "$mongodb_setup" == "sharded" ]; then
    bash ./mongo_startup.sh -s -e wiredTiger --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=./psmdb_${mongodb_version}/bin
    pmm-admin add mongodb --cluster mongodb_node_cluster --environment=mongodb_shraded_node mongodb_shraded_node_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27017
    sleep 2
    pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=config --environment=mongodb_config_node mongodb_config_1_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27027
    sleep 2
    pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=config --environment=mongodb_config_node mongodb_config_2_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27028
    sleep 2
    pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=config --environment=mongodb_config_node mongodb_config_3_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27029
    sleep 2
    pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node mongodb_rs1_1_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27018
    sleep 2
    pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node mongodb_rs1_2_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27019
    sleep 2
    pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node mongodb_rs1_3_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27020
    sleep 2
    pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs2 --environment=mongodb_rs_node mongodb_rs2_1_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:28018
    sleep 2
    pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs2 --environment=mongodb_rs_node mongodb_rs2_2_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:28019
    sleep 2
    pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs2 --environment=mongodb_rs_node mongodb_rs2_3_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:28020
    sleep 20
    ./nodes/cl_mongos.sh mongodb_user_setup.js
fi

if [ "$mongodb_setup" == "replica" ]; then
    bash ./mongo_startup.sh -r -e wiredTiger --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=./psmdb_${mongodb_version}/bin
    sleep 20
    pmm-admin remove mongodb mongodb_rs1_1 || true; pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node --metrics-mode=$metrics_mode mongodb_rs1_1_${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:27017
    sleep 2
    pmm-admin remove mongodb mongodb_rs1_2 || true; pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node --metrics-mode=$metrics_mode mongodb_rs1_2_${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:27018
    sleep 2
    pmm-admin remove mongodb mongodb_rs1_3 || true; pmm-admin add mongodb --cluster mongodb_node_cluster --replication-set=rs1 --environment=mongodb_rs_node --metrics-mode=$metrics_mode mongodb_rs1_3_${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:27019
    sleep 20
    ./nodes/cl.sh mongodb_user_setup.js
fi

if [ "$mongodb_setup" == "regular" ]; then
    bash ./mongo_startup.sh -m -e wiredTiger --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=./psmdb_${mongodb_version}/bin
    pmm-admin add mongodb --cluster mongodb_node_cluster --environment=mongodb_single_node mongodb_rs_single_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27017
    sleep 20
    ./nodes/cl.sh mongodb_user_setup.js
fi
