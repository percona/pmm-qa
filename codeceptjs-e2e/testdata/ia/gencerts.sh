#!/bin/bash

export PWD=$(pwd)

### Test self-signed certificates support:
# Generate private key:
openssl genrsa -out ${PWD}/testdata/ia/certs/server.key
## Generate self-signed certificate:
openssl req -key ${PWD}/testdata/ia/certs/server.key -new -x509 -days 365 -out ${PWD}/testdata/ia/certs/self.crt -config ${PWD}/testdata/ia/certs/ssl.cnf
