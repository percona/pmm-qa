#!/bin/bash

# Prepare a set of base64 encoded values and non encoded for user and pass with administrator privileges to pmm-server (DBaaS)
PMM_USER='admin';
PMM_PASS='admin';
PXC_OPERATOR_VERSION=$1;
PSMDB_OPERATOR_VERSION=$2;

if [ "$PXC_OPERATOR_VERSION" == none ] ; then
	echo "No PXC operator installed"
else
	curl -sSf -m 30 https://raw.githubusercontent.com/percona/percona-xtradb-cluster-operator/"${PXC_OPERATOR_VERSION}"/deploy/bundle.yaml | kubectl apply -f -
fi

if [ "$PSMDB_OPERATOR_VERSION" == none ] ; then
	echo "No PSMDB operator installed"
else
	curl -sSf -m 30 https://raw.githubusercontent.com/percona/percona-server-mongodb-operator/"${PSMDB_OPERATOR_VERSION}"/deploy/bundle.yaml | kubectl apply -f -
fi

PMM_USER_B64="$(echo -n "${PMM_USER}" | base64)";
PMM_PASS_B64="$(echo -n "${PMM_PASS}" | base64)";
