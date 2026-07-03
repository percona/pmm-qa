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

if [ ! -f mongodb_user_setup.js ]; then
  wget https://raw.githubusercontent.com/percona/pmm-qa/main/pmm-tests/mongodb_user_setup.js
fi

resolve_psmdb_tarball() {
  version="$1"
  psmdb_latest=$(wget -q --post-data "version=percona-server-mongodb-${version}" https://www.percona.com/products-api.php -O - \
    | grep -oP '(?<=value=")[^"]*' | sort -V | tail -1)
  if [ -n "$psmdb_latest" ]; then
    if [ "$version" = "4.4" ]; then
      wget -q --post-data "version_files=${psmdb_latest}&software_files=binary" https://www.percona.com/products-api.php -O - \
        | jq -r '.[] | select(.link | contains("sha") | not) | .link' | grep glibc2\.17-minimal | head -1
    else
      wget -q --post-data "version_files=${psmdb_latest}&software_files=binary" https://www.percona.com/products-api.php -O - \
        | jq -r '.[] | select(.link | contains("sha") | not) | .link' | grep -E 'glibc2\.17-minimal|jammy-minimal' | head -1
    fi
  fi
}

resolve_hardcoded_tarball() {
  version="$1"
  case "$version" in
    4.4) echo "https://downloads.percona.com/downloads/percona-server-mongodb-4.4/percona-server-mongodb-4.4.29-28/binary/tarball/percona-server-mongodb-4.4.29-28-x86_64.glibc2.17-minimal.tar.gz" ;;
    5.0) echo "https://downloads.percona.com/downloads/percona-server-mongodb-LATEST/percona-server-mongodb-5.0.11-10/binary/tarball/percona-server-mongodb-5.0.11-10-x86_64.glibc2.17-minimal.tar.gz" ;;
    6.0) echo "https://downloads.percona.com/downloads/percona-distribution-mongodb-6.0/percona-distribution-mongodb-6.0.12/binary/tarball/percona-server-mongodb-6.0.12-9-x86_64.glibc2.17-minimal.tar.gz" ;;
    7.0) echo "https://downloads.percona.com/downloads/percona-server-mongodb-7.0/percona-server-mongodb-7.0.2-1/binary/tarball/percona-server-mongodb-7.0.2-1-x86_64.glibc2.17.tar.gz" ;;
    8.0) echo "" ;;
  esac
}

resolve_community_tarball() {
  version="$1"
  curl -s "https://www.mongodb.com/try/download/community" \
    | grep -oP "https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-ubuntu2204-${version//./\\.}\.\d+\.tgz" \
    | sort -V | tail -n 1
}

psmdb_tarball=$(resolve_psmdb_tarball "$mongodb_version")
if [ -z "$psmdb_tarball" ]; then
  psmdb_tarball=$(resolve_hardcoded_tarball "$mongodb_version")
fi
if [ -z "$psmdb_tarball" ]; then
  echo "No Percona tarball found for mongodb ${mongodb_version}; trying community MongoDB"
  psmdb_tarball=$(resolve_community_tarball "$mongodb_version")
fi
if [ -z "$psmdb_tarball" ] && [ "$mongodb_version" != "7.0" ]; then
  echo "Falling back to mongodb 7.0"
  mongodb_version=7.0
  psmdb_tarball=$(resolve_psmdb_tarball "$mongodb_version")
  if [ -z "$psmdb_tarball" ]; then
    psmdb_tarball=$(resolve_hardcoded_tarball "$mongodb_version")
  fi
  if [ -z "$psmdb_tarball" ]; then
    psmdb_tarball=$(resolve_community_tarball "$mongodb_version")
  fi
fi
if [ -z "$psmdb_tarball" ]; then
  echo "Failed to resolve PSMDB tarball for version ${mongodb_version}" >&2
  exit 1
fi

echo "Downloading ${mongodb_version} from ${psmdb_tarball} ..."
wget -O percona_server_mongodb.tar.gz "${psmdb_tarball}"
tar -xvf percona_server_mongodb.tar.gz
extracted_folder=$(ls -d percona-server-mongodb-* mongodb-linux-* 2>/dev/null | head -1)
mv "${extracted_folder}" "psmdb_${mongodb_version}"
rm -f percona_server_mongodb.tar.gz*

if [[ "$mongodb_version" == "6.0" || "$mongodb_version" == "7.0" || "$mongodb_version" == "8.0" ]]; then
    echo "Downloading mongosh ..."
    mongosh_version=7.0
    mongosh_latest=$(wget -q --post-data "version=percona-server-mongodb-${mongosh_version}" https://www.percona.com/products-api.php -O - \
      | grep -oP '(?<=value=")[^"]*' | sort -V | tail -1)
    mongosh_link=""
    if [ -n "$mongosh_latest" ]; then
      mongosh_link=$(wget -q --post-data "version_files=${mongosh_latest}&software_files=binary" https://www.percona.com/products-api.php -O - \
        | jq -r '.[] | select(.link | contains("sha") | not) | .link' | grep mongosh | head -1)
    fi
    if [ -z "$mongosh_link" ]; then
      mongosh_link="https://downloads.mongodb.com/compass/mongosh-2.3.8-linux-x64.tgz"
    fi
    wget -O mongosh.tar.gz "${mongosh_link}"
    tar -xvf mongosh.tar.gz
    if ls percona-mongodb-mongosh* >/dev/null 2>&1; then
      mv percona-mongodb-mongosh* mongosh
      cp mongosh/bin/mongosh "./psmdb_${mongodb_version}/bin/mongo"
    else
      mv mongosh-* mongosh 2>/dev/null || true
      cp mongosh/bin/mongosh "./psmdb_${mongodb_version}/bin/mongo"
    fi
    rm -f mongosh.tar.gz
fi

# For mongodb dependency in Debian
wget http://http.us.debian.org/debian/pool/main/o/openldap/libldap-2.4-2_2.4.47+dfsg-3+deb10u7_amd64.deb
apt install -y ./libldap-2.4-2_2.4.47+dfsg-3+deb10u7_amd64.deb

mlaunch init --bind_ip 0.0.0.0 --binarypath "./psmdb_${mongodb_version}/bin" --replicaset --name rs1 --nodes 3 --sslMode requireSSL --sslPEMKeyFile /certificates/server.pem --sslCAFile /certificates/ca.crt --sslClientCertificate /certificates/client.pem
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
