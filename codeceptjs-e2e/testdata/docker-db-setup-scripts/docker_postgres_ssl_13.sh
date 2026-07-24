#!/bin/bash

mkdir -p testdata/pgsql/ssl-cert-scripts
cp testdata/mysql/ssl-cert-scripts/*.sh testdata/pgsql/ssl-cert-scripts
pushd testdata/pgsql/ssl-cert-scripts
bash ./gencerts.sh
sudo chown 70:70 certs/server-key.pem
sudo chmod 600 certs/server-key.pem
ls -la
popd
PWD=$(pwd) docker-compose -f docker-compose-postgresql-ssl.yml up -d
