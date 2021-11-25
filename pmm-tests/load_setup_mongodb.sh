#!/bin/bash

sudo yum install wget tar svn git -y
wget https://github.com/feliixx/mgodatagen/releases/download/v0.9.4/mgodatagen_0.9.4_Linux_x86_64.tar.gz
tar -xvf mgodatagen_0.9.4_Linux_x86_64.tar.gz

sudo svn export https://github.com/Percona-QA/percona-qa.git/trunk/mongo_startup.sh
wget https://downloads.percona.com/downloads/percona-server-mongodb-LATEST/percona-server-mongodb-4.4.10-11/binary/tarball/percona-server-mongodb-4.4.10-11-x86_64.glibc2.17-minimal.tar.gz

tar -xvf percona-server-mongodb-4.4.10-11-x86_64.glibc2.17-minimal.tar.gz
mv percona-server-mongodb-4.4.10-11-x86_64.glibc2.17-minimal psmdb_4_4

bash ./mongo_startup.sh -r -e wiredTiger --mongosExtra="--slowms 1" --mongodExtra="--profile 2 --slowms 1" --configExtra="--profile 2 --slowms 1" --b=/root/psmdb_4_4/bin

wget https://raw.githubusercontent.com/feliixx/mgodatagen/master/datagen/generators/testdata/full-bson.json

for j in {1..25}
    do
    for i in {1..40}
        do
            cp full-bson.json full-bson-$i.json
            sed "s/test_bson/test_bson_${i}/g" -i full-bson-$i.json
            sed "s/mgodatagen_test/mgodatagen_test_${j}/g" -i full-bson-$i.json
            ./mgodatagen -f full-bson-$i.json
            rm -f full-bson-$i.json
            sleep 20
    done
done
