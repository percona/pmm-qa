#!/bin/sh

while [ $# -gt 0 ]; do
   if [[ $1 == *"--"* ]]; then
        param="${1/--/}"
        declare $param="$2"
   fi
  shift
done

if [ -z "$mongodb_version" ]; then
  export mongodb_version=4.4
fi

if [ -z "$mongdb_setup" ]; then
  export mongdb_setup=replica
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

wget https://raw.githubusercontent.com/Percona-QA/percona-qa/master/mongo_startup.sh
chmod +x mongo_startup.sh
export SERVICE_RANDOM_NUMBER=$(echo $((1 + $RANDOM % 9999)))

### Detect latest tarball link for specified mongodb_version: 7.0 | 6.0 | 5.0 | 4.4 | 4.2 at the moment
psmdb_latest=$(wget -q --post-data "version=percona-server-mongodb-${mongodb_version}" https://www.percona.com/products-api.php -O - | grep  -oP "(?<=value\=\")[^\"]*" | sort -V | tail -1)
psmdb_tarball=$(wget -q --post-data "version_files=${psmdb_latest}&software_files=binary" https://www.percona.com/products-api.php -O - | jq -r '.[] | select(.link | contains("sha") | not) | .link' | grep glibc2\.17-minimal)

echo "Downloading ${psmdb_latest} ..."
wget -O percona_server_mongodb.tar.gz ${psmdb_tarball}
tar -xvf percona_server_mongodb.tar.gz

export extracted_folder_name=$(ls | grep percona-server-mongodb)
echo "Extracted folder name ${extracted_folder_name}"
mv ${extracted_folder_name} psmdb_${mongodb_version}

# TODO: refactor if to match range of versions 6.0+
if [[ "$mongodb_version" == "6.0" || "$mongodb_version" == "7.0" ]]; then
    ### PSMDB 6+ requires "percona-mongodb-mongosh" additionally
    echo "Downloading mongosh ..."
    mongosh_link=$(wget -q --post-data "version_files=${psmdb_latest}&software_files=binary" https://www.percona.com/products-api.php -O - | jq -r '.[] | select(.link | contains("sha") | not) | .link' | grep mongosh)
    wget -O mongosh.tar.gz ${mongosh_link}
    tar -xvf mongosh.tar.gz
    mv percona-mongodb-mongosh* mongosh
    cp mongosh/bin/mongosh ./psmdb_${mongodb_version}/bin/mongo
    rm mongosh.tar.gz
fi

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
    #./nodes/cl_mongos.sh mongodb_user_setup.js
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
fi

#Arbiter setup with Auth enabled (keyfile)
if [ "$mongodb_setup" == "arbiter" ]; then
    bash ./mongo_startup.sh -x -r -a -e wiredTiger --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=./psmdb_${mongodb_version}/bin
    sleep 20
    pmm-admin remove mongodb mongodb_rs2_1 || true; pmm-admin add mongodb --cluster mongodb_node_cluster2 --replication-set=rs2 --environment=mongodb_rs_node --metrics-mode=$metrics_mode mongodb_rs2_1_${SERVICE_RANDOM_NUMBER} --debug --username=${user} --password=${pwd} 127.0.0.1:27017
    sleep 2
    pmm-admin remove mongodb mongodb_rs2_2 || true; pmm-admin add mongodb --cluster mongodb_node_cluster2 --replication-set=rs2 --environment=mongodb_rs_node --metrics-mode=$metrics_mode mongodb_rs2_2_${SERVICE_RANDOM_NUMBER} --debug --username=${user} --password=${pwd} 127.0.0.1:27018
    sleep 2
    pmm-admin remove mongodb mongodb_rs2_3 || true; pmm-admin add mongodb --cluster mongodb_node_cluster2 --replication-set=rs2 --environment=mongodb_rs_node --metrics-mode=$metrics_mode mongodb_rs2_3_${SERVICE_RANDOM_NUMBER} --debug 127.0.0.1:27019
    sleep 20
fi


if [ "$mongodb_setup" == "regular" ]; then
    bash ./mongo_startup.sh -m -e wiredTiger --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=./psmdb_${mongodb_version}/bin
    pmm-admin add mongodb --cluster mongodb_node_cluster --environment=mongodb_single_node mongodb_rs_single_${SERVICE_RANDOM_NUMBER} --metrics-mode=$metrics_mode --debug 127.0.0.1:27017
    sleep 20
fi
rm percona_server_mongodb.tar.gz*
