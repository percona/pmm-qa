#!/bin/bash

export MONGODB_VERSION=$1
export TYPE_OF_DEPLOYMENT=$2

apt-get update
apt-get install wget tar git -y
wget https://github.com/feliixx/mgodatagen/releases/download/v0.9.4/mgodatagen_0.9.4_Linux_x86_64.tar.gz
tar -xvf mgodatagen_0.9.4_Linux_x86_64.tar.gz
export MONGODB_BINARY=$(wget -qO- https://www.percona.com/downloads/percona-server-mongodb-${MONGODB_VERSION}/LATEST/binary/ | grep -Eo "(http|https)://[a-zA-Z0-9./?=_%:-]*-minimal.tar.gz" | sort -u)
wget ${MONGODB_BINARY}

wget https://raw.githubusercontent.com/Percona-QA/percona-qa/master/mongo_startup.sh

tar -xvf percona-server-mongodb-${MONGODB_VERSION}*.tar.gz
rm percona-server-mongodb-${MONGODB_VERSION}*.tar.gz
mv percona-server-mongodb-${MONGODB_VERSION}* psmdb_${MONGODB_VERSION}

if [[ "$TYPE_OF_DEPLOYMENT" == "sharding" ]]; then
  echo "Setting up Sharded Cluster";
  bash ./mongo_startup.sh -s -e wiredTiger --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=$(pwd)/psmdb_${MONGODB_VERSION}/bin
elif [[ "$TYPE_OF_DEPLOYMENT" == "replicaset" ]]; then
  echo "Setting up replicaset";
  bash ./mongo_startup.sh -r -e wiredTiger --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=$(pwd)/psmdb_${MONGODB_VERSION}/bin
else
  echo "Setting up Regular Deployment";
  bash ./mongo_startup.sh -m -e wiredTiger --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=$(pwd)/psmdb_${MONGODB_VERSION}/bin
fi

wget https://raw.githubusercontent.com/feliixx/mgodatagen/master/datagen/generators/testdata/full-bson.json
sleep 10
./nodes/cl_primary.sh /tmp/mongodb/mongodb_user_setup.js
echo "MongoDB setup Ready for Connection, waiting for connections on port 27017";

#for j in {1..2}
#    do
#    for i in {1..10}
#        do
#            cp full-bson.json full-bson-$i.json
#            sed "s/test_bson/test_bson_${i}/g" -i full-bson-$i.json
#            sed "s/mgodatagen_test/mgodatagen_test_${j}/g" -i full-bson-$i.json
#            ./mgodatagen -f full-bson-$i.json
#            rm -f full-bson-$i.json
#            sleep 20
#    done
#done
