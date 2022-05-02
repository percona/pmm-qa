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

apt-get update
apt-get -y install wget curl git
wget https://repo.percona.com/apt/percona-release_latest.generic_all.deb
dpkg -i percona-release_latest.generic_all.deb
wget https://raw.githubusercontent.com/Percona-QA/percona-qa/master/mongo_startup.sh
chmod +x mongo_startup.sh
wget https://raw.githubusercontent.com/percona/pmm-qa/main/pmm-tests/mongodb_user_setup.js
if [ "$mongodb_version" == "4.4" ]; then
   wget -O percona_server_mongodb.tar.gz https://downloads.percona.com/downloads/percona-server-mongodb-4.4/percona-server-mongodb-4.4.13-13/binary/tarball/percona-server-mongodb-4.4.13-13-x86_64.glibc2.17-minimal.tar.gz
fi

if [ "$mongodb_version" == "4.2" ]; then
   wget -O percona_server_mongodb.tar.gz https://downloads.percona.com/downloads/percona-server-mongodb-4.2/percona-server-mongodb-4.2.19-19/binary/tarball/percona-server-mongodb-4.2.19-19-x86_64.glibc2.17-minimal.tar.gz
fi

if [ "$mongodb_version" == "4.0" ]; then
   wget -O percona_server_mongodb.tar.gz https://downloads.percona.com/downloads/percona-server-mongodb-4.0/percona-server-mongodb-4.0.28-23/binary/tarball/percona-server-mongodb-4.0.28-23-x86_64.glibc2.17-minimal.tar.gz
fi

if [ "$mongodb_version" == "5.0" ]; then
   wget -O percona_server_mongodb.tar.gz https://downloads.percona.com/downloads/percona-server-mongodb-5.0/percona-server-mongodb-5.0.7-6/binary/tarball/percona-server-mongodb-5.0.7-6-x86_64.glibc2.17-minimal.tar.gz
fi

tar -xvf percona_server_mongodb.tar.gz
rm percona_server_mongodb.tar.gz*
mv percona-server-mongodb-${mongodb_version}.* psmdb_${mongodb_version}

bash ./mongo_startup.sh -m --ssl -x -e wiredTiger --mongodExtra="--profile 2 --slowms 1 --bind_ip_all" --b=/psmdb_${mongodb_version}/bin
sleep 20
/nodes/cl.sh mongodb_user_setup.js
cat > add_new_ssl_user.js <<EOF
db.getSiblingDB("\$external").runCommand(
      {
      createUser: "emailAddress=test@percona.com,CN=localhost,OU=client,O=Percona,L=San Francisco,ST=California,C=US",
      roles: [
             { role: "readWrite", db: 'test' },
             { role: "explainRole", db: "admin" },
             { role: "clusterMonitor", db: "admin" },
             { role: "read", db: "local" },
             { role: 'root', db: 'admin' }
        ],
      writeConcern: { w: "majority" , wtimeout: 5000 }
      }
);
db.getSiblingDB("\$external").auth(
  {
    mechanism: "MONGODB-X509",
    user: "emailAddress=test@percona.com,CN=localhost,OU=client,O=Percona,L=San Francisco,ST=California,C=US"
  }
);
print("Added new user ssl");
db.getSiblingDB("test").test.insert({a:1});
db.getSiblingDB("test").test.insert({b:2});
EOF
/nodes/cl.sh add_new_ssl_user.js
