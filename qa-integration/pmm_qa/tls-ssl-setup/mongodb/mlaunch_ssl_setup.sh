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

wget https://raw.githubusercontent.com/percona/pmm-qa/main/pmm-tests/mongodb_user_setup.js
### Detect latest tarball link for specified mongodb_version: 7.0 | 6.0 | 5.0 | 4.4 | 4.2 at the moment
#psmdb_latest=$(wget -q --post-data "version=percona-server-mongodb-${mongodb_version}" https://www.percona.com/products-api.php -O - | grep  -oP "(?<=value\=\")[^\"]*" | sort -V | tail -1)
psmdb_tarball=$(wget -q --post-data "version_files=percona-server-mongodb-${mongodb_version}&software_files=binary" https://www.percona.com/products-api.php -O - | jq -r '.[] | select(.link | contains("sha") | not) | .link' | grep glibc2\.17-minimal)

echo "Downloading ${mongodb_version} ..."
wget -O percona_server_mongodb.tar.gz ${psmdb_tarball}
tar -xvf percona_server_mongodb.tar.gz
mv percona-server-mongodb-${mongodb_version}.* psmdb_${mongodb_version}
rm percona_server_mongodb.tar.gz*

# TODO: refactor if to match range of versions 6.0+
if [[ "$mongodb_version" == "6.0" || "$mongodb_version" == "7.0" ]]; then
    ### PSMDB 6+ requires "percona-mongodb-mongosh" additionally
    echo "Downloading mongosh ..."
    mongosh_link=$(wget -q --post-data "version_files=percona-server-mongodb-${mongodb_version}&software_files=binary" https://www.percona.com/products-api.php -O - | jq -r '.[] | select(.link | contains("sha") | not) | .link' | grep mongosh)
    wget -O mongosh.tar.gz ${mongosh_link}
    tar -xvf mongosh.tar.gz
    mv percona-mongodb-mongosh* mongosh
    cp mongosh/bin/mongosh ./psmdb_${mongodb_version}/bin/mongo
    rm mongosh.tar.gz
fi

# For mongodb dependency in Debian
wget http://http.us.debian.org/debian/pool/main/o/openldap/libldap-2.4-2_2.4.47+dfsg-3+deb10u7_amd64.deb
apt install -y ./libldap-2.4-2_2.4.47+dfsg-3+deb10u7_amd64.deb

mlaunch init --bind_ip 0.0.0.0 --binarypath "./psmdb_${mongodb_version}/bin" --replicaset --name rs1 --nodes 3 --sslMode requireSSL --sslPEMKeyFile /certificates/server.pem --sslCAFile /certificates/ca.crt --sslClientCertificate /certificates/client.pem
#bash ./mongo_startup.sh -m --ssl -x -e wiredTiger --mongodExtra="--profile 2 --slowms 1 --bind_ip_all" --b=/psmdb_${mongodb_version}/bin
sleep 20
./psmdb_${mongodb_version}/bin/mongo --tls --host localhost --port 27017 --tlsCAFile /certificates/ca.crt --tlsCertificateKeyFile /certificates/client.pem mongodb_user_setup.js
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
./psmdb_${mongodb_version}/bin/mongo --tls --host localhost --port 27017 --tlsCAFile /certificates/ca.crt --tlsCertificateKeyFile /certificates/client.pem add_new_ssl_user.js
