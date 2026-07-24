#!/bin/sh

export PWD=$(pwd)
export HOST=localhost
mkdir -p certificates
pushd certificates
echo -e "\n=== Generating SSL certificates in ${PWD}/certificates ==="
# Generate self signed root CA cert
openssl req -nodes -x509 -newkey rsa:4096 -keyout ca.key -out ca.crt -subj "/C=US/ST=California/L=San Francisco/O=Percona/OU=root/CN=${HOST}/emailAddress=test@percona.com"
# Generate server cert to be signed
openssl req -nodes -newkey rsa:4096 -keyout server.key -out server.csr -subj "/C=US/ST=California/L=San Francisco/O=Percona/OU=server/CN=${HOST}/emailAddress=test@percona.com"
# Sign server sert
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -set_serial 01 -out server.crt
# Create server PEM file
cat server.key server.crt > server.pem
# Generate client cert to be signed
openssl req -nodes -newkey rsa:4096 -keyout client.key -out client.csr -subj "/C=US/ST=California/L=San Francisco/O=Percona/OU=client/CN=${HOST}/emailAddress=test@percona.com"
# Sign the client cert
openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -set_serial 02 -out client.crt
# Create client PEM file
cat client.key client.crt > client.pem
popd
