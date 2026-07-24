#!/bin/bash

pushd testdata/mongodb/
bash ./gencerts.sh
sleep 20
popd
PWD=$(pwd) docker-compose -f docker-compose-mongodb-ssl.yml up -d

cat > add_new_user.js <<EOF
db.getSiblingDB("\$external").runCommand(
  	{
    	createUser: "CN=fake-CA,OU=client,O=MongoDB,L=Sydney,ST=NSW,C=AU",
    	roles: [
             { role: "readWrite", db: 'test' }
        ],
    	writeConcern: { w: "majority" , wtimeout: 5000 }
  	}
);
db.getSiblingDB("\$external").auth(
  {
    mechanism: "MONGODB-X509",
    user: "CN=fake-CA,OU=client,O=MongoDB,L=Sydney,ST=NSW,C=AU"
  }
);
print("Added new user ssl");
db.getSiblingDB("test").test.insert({a:1});
db.getSiblingDB("test").test.insert({b:2});
EOF

docker cp add_new_user.js mongodb_ssl:/
docker exec mongodb_ssl mongo localhost --ssl --sslPEMKeyFile /etc/ssl/certificates/client.pem --sslCAFile /etc/ssl/certificates/ca.crt --sslAllowInvalidCertificates --sslAllowInvalidHostnames add_new_user.js
