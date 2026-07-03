#!/bin/bash

# REPO - repo for PSMDB/PBM packages, by default - testing
# PMM_REPO - repo for PMM packages, by default - experimental
# PBM_VERSION - PBM version, by default - latest
# PSMDB_VERSION - PSMDB version, by default - latest
# PMM_CLIENT_VERSION - PMM client version, by default - latest
# PMM_SERVER_IMAGE / PMM_IMAGE - PMM server docker image (CI uses PMM_SERVER_IMAGE)
# AWS_USERNAME - username of AWS user whose creds are provided, AWS auth tests are skipped unless creds are provided
# AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY - self-descriptive
# TESTS - whether to run tests, by default - yes
# CLEANUP - whether to remove setup, by default - yes

set -e

# PSMDB 4.2 doesn't support AWS auth
if [[ -n "$PSMDB_VERSION" ]] && [[ "$PSMDB_VERSION" == *"4.2."* ]]; then
    sed -i 's/,MONGODB-AWS//' conf/mongod.conf
    export SKIP_AWS_TESTS="true"
fi

if [ -z "$ADMIN_PASSWORD" ]; then
    export ADMIN_PASSWORD=admin
fi

compose() {
    local files=(-f docker-compose-psmdb.yml)
    if [[ "${IS_CURSOR_VM:-}" == "1" ]]; then
        files+=(-f docker-compose-psmdb.microvm.yaml)
    fi
    docker compose "${files[@]}" "$@"
}

bash -e ./generate-certs.sh

#Start setup
compose down -v --remove-orphans
compose build
compose up -d

#Add users
compose exec -T psmdb-server mongo --quiet << EOF
db.getSiblingDB("admin").createUser({ user: "root", pwd: "root", roles: [ "root", "userAdminAnyDatabase", "clusterAdmin" ] });
EOF
compose exec -T psmdb-server mongo --quiet "mongodb://root:root@localhost/?replicaSet=rs0" < init/setup_psmdb.js

#Configure PBM
compose exec -T psmdb-server bash -c "echo \"PBM_MONGODB_URI=mongodb://pbm:pbmpass@127.0.0.1:27017\" > /etc/sysconfig/pbm-agent"
compose exec -T psmdb-server systemctl restart pbm-agent

#Configure PMM
set +e
i=1
while [ $i -le 3 ]; do
    output=$(compose exec -T psmdb-server pmm-agent setup --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml --server-address=pmm-server:8443 --metrics-mode=auto --server-username=admin --server-password=${ADMIN_PASSWORD} --server-insecure-tls)
    exit_code=$?

    if [ $exit_code -ne 0 ] && [[ $output == *"500 Internal Server Error"* ]]; then
        i=$((i + 1))
    else
        break
    fi
    sleep 1
done

#Add Mongo Service
random_number=$RANDOM
compose exec -T psmdb-server pmm-admin add mongodb psmdb-server_${random_number} --agent-password=mypass --username=pmm_mongodb --password="5M](Q%q/U+YQ<^m" --host psmdb-server --port 27017 --tls --tls-certificate-key-file=/mongodb_certs/client.pem --tls-ca-file=/mongodb_certs/ca-certs.pem --cluster=mycluster
#Add some data
compose exec -T psmdb-server mgodatagen -f /etc/datagen/replicaset.json --username=pmm_mongodb --password="5M](Q%q/U+YQ<^m" --host psmdb-server --port 27017 --tlsCertificateKeyFile=/mongodb_certs/client.pem --tlsCAFile=/mongodb_certs/ca-certs.pem

tests=${TESTS:-yes}
if [ $tests = "yes" ]; then
    echo "running tests"
    output=$(compose run test pytest -s --verbose test.py)
    else
    echo "skipping tests"
fi

cleanup=${CLEANUP:-yes}
if [ $cleanup = "yes" ]; then
    echo "cleanup"
    compose down -v --remove-orphans
    if [[ -n "$PSMDB_VERSION" ]] && [[ "$PSMDB_VERSION" == *"4.2"* ]]; then
       sed -i 's/MONGODB-X509/MONGODB-X509,MONGODB-AWS/' conf/mongod.conf
    fi
    else
    echo "skipping cleanup"
fi

echo "$output"
if echo "$output" | grep -q "\bFAILED\b"; then
    exit 1
fi
