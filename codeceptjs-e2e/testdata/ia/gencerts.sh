#!/bin/bash

repo_root=$(pwd)

### Test self-signed certificates support:
# Generate private key:
openssl genrsa -out ${repo_root}/testdata/ia/certs/server.key
## Generate self-signed certificate:
openssl req -key ${repo_root}/testdata/ia/certs/server.key -new -x509 -days 365 -out ${repo_root}/testdata/ia/certs/self.crt -config ${repo_root}/testdata/ia/certs/ssl.cnf
