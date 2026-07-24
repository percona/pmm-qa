#!/bin/bash

pushd testdata/mysql/ssl-cert-scripts/
bash ./gencerts.sh
docker exec mysql_ssl bash -c "mkdir -p /root/certs"
docker exec mysql_ssl mkdir -p /root/certs
docker cp ./certs/. mysql_ssl:/root/certs
docker exec mysql_ssl chown -R mysql:mysql /root/certs/
docker exec mysql_ssl bash -c "mv -v /root/certs/ /etc/certs/"
docker exec mysql_ssl ls -la /etc/certs/
docker exec mysql_ssl chmod 600 /etc/certs/client-key.pem /etc/certs/server-key.pem /etc/certs/root-ca-key.pem
docker exec mysql_ssl mysql -u root -pr00tr00t -e "SET GLOBAL slow_query_log='ON';"
docker restart mysql_ssl
sleep 20
popd
