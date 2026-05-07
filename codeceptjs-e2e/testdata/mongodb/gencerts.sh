#!/bin/bash

mkdir -p certs

# Generate self signed root CA cert
openssl req -nodes -x509 -newkey rsa:2048 -keyout certs/ca.key -out certs/ca.crt -subj "/C=AU/ST=NSW/L=Sydney/O=MongoDB/OU=root/CN=fake-CA"


# Generate server cert to be signed
openssl req -nodes -newkey rsa:2048 -keyout certs/server.key -out certs/server.csr -subj "/C=AU/ST=NSW/L=Sydney/O=MongoDB/OU=server/CN=fake-CA"

# Sign the server cert
openssl x509 -req -in certs/server.csr -CA certs/ca.crt -CAkey certs/ca.key -CAcreateserial -out certs/server.crt

# Create server PEM file
cat certs/server.key certs/server.crt > certs/server.pem


# Generate client cert to be signed
openssl req -nodes -newkey rsa:2048 -keyout certs/client.key -out certs/client.csr -subj "/C=AU/ST=NSW/L=Sydney/O=MongoDB/OU=client/CN=fake-CA"

# Sign the client cert
openssl x509 -req -in certs/client.csr -CA certs/ca.crt -CAkey certs/ca.key -CAserial certs/ca.srl -out certs/client.crt

# Create client PEM file
cat certs/client.key certs/client.crt > certs/client.pem
