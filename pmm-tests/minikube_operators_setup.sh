#!/bin/bash

# Prepare a set of base64 encoded values and non encoded for user and pass with administrator privileges to pmm-server (DBaaS)
PMM_USER='admin';
PMM_PASS='admin';

PMM_USER_B64="$(echo -n "${PMM_USER}" | base64)";
PMM_PASS_B64="$(echo -n "${PMM_PASS}" | base64)";

# Install the PXC operator
curl -sSf -m 30 https://raw.githubusercontent.com/percona/percona-xtradb-cluster-operator/pmm-branch/deploy/bundle.yaml | minikube kubectl -- apply -f -
curl -sSf -m 30 https://raw.githubusercontent.com/percona/percona-xtradb-cluster-operator/pmm-branch/deploy/secrets.yaml | sed "s/pmmserver:.*=/pmmserver: ${PMM_PASS_B64}/g" | minikube kubectl -- apply -f -

# Install the PSMDB operator
curl -sSf -m 30 https://raw.githubusercontent.com/percona/percona-server-mongodb-operator/v1.6.0/deploy/bundle.yaml | minikube kubectl -- apply -f -
curl -sSf -m 30 https://raw.githubusercontent.com/percona/percona-server-mongodb-operator/v1.6.0/deploy/secrets.yaml | sed "s/PMM_SERVER_USER:.*$/PMM_SERVER_USER: ${PMM_USER}/g;s/PMM_SERVER_PASSWORD:.*$/PMM_SERVER_PASSWORD: ${PMM_PASS}/g;" | minikube kubectl -- apply -f -
