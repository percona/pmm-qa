#!/bin/bash

# Prepare a set of base64 encoded values and non encoded for user and pass with administrator privileges to pmm-server (DBaaS)
PMM_USER='admin';
PMM_PASS='admin';
OPERATOR_VERSION=$1;

if [ -z "$OPERATOR_VERSION" ] ; then
	echo "Error: no parameter passed"
	echo "Use: bash ./minikube_operators_setup.sh <operator_version>"
	exit 1
fi

PMM_USER_B64="$(echo -n "${PMM_USER}" | base64)";
PMM_PASS_B64="$(echo -n "${PMM_PASS}" | base64)";

# Install the PXC operator
curl -sSf -m 30 https://raw.githubusercontent.com/percona/percona-xtradb-cluster-operator/v1.8.0/deploy/bundle.yaml \
| minikube kubectl -- apply -f -

# Install the PSMDB operator
curl -sSf -m 30 https://raw.githubusercontent.com/percona/percona-server-mongodb-operator/v${OPERATOR_VERSION}/deploy/bundle.yaml \
| minikube kubectl -- apply -f -
