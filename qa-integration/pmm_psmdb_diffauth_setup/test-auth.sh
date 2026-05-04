#!/bin/bash

# REPO - repo for PSMDB/PBM packages, by default - testing
# PMM_REPO - repo for PMM packages, by default - experimental
# PBM_VERSION - PBM version, by default - latest
# PSMDB_VERSION - PSMDB version, by default - latest
# PMM_CLIENT_VERSION - PMM client version, by default - latest
# PMM_IMAGE - PMM server version, by default - perconalab/pmm-server:dev-latest
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

bash -e ./generate-certs.sh

#Start setup
docker compose -f docker-compose-pmm-psmdb.yml down -v --remove-orphans
docker compose -f docker-compose-pmm-psmdb.yml build
docker compose -f docker-compose-pmm-psmdb.yml up -d

#Add users
docker compose -f docker-compose-pmm-psmdb.yml exec -T psmdb-server mongo --quiet << EOF
db.getSiblingDB("admin").createUser({ user: "root", pwd: "root", roles: [ "root", "userAdminAnyDatabase", "clusterAdmin" ] });
EOF
docker compose -f docker-compose-pmm-psmdb.yml exec -T psmdb-server mongo --quiet "mongodb://root:root@localhost/?replicaSet=rs0" < init/setup_psmdb.js

#Configure PBM
docker compose -f docker-compose-pmm-psmdb.yml exec -T psmdb-server bash -c "echo \"PBM_MONGODB_URI=mongodb://pbm:pbmpass@127.0.0.1:27017\" > /etc/sysconfig/pbm-agent"
docker compose -f docker-compose-pmm-psmdb.yml exec -T psmdb-server systemctl restart pbm-agent

#Configure PMM
set +e
i=1
while [ $i -le 3 ]; do
    output=$(docker compose -f docker-compose-pmm-psmdb.yml exec -T psmdb-server pmm-agent setup --config-file=/usr/local/percona/pmm/config/pmm-agent.yaml --server-address=pmm-server:8443 --metrics-mode=auto --server-username=admin --server-password=${ADMIN_PASSWORD} --server-insecure-tls)
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
docker compose -f docker-compose-pmm-psmdb.yml exec -T psmdb-server pmm-admin add mongodb psmdb-server_${random_number} --agent-password=mypass --username=pmm_mongodb --password="5M](Q%q/U+YQ<^m" --host psmdb-server --port 27017 --tls --tls-certificate-key-file=/mongodb_certs/client.pem --tls-ca-file=/mongodb_certs/ca-certs.pem --cluster=mycluster
#Add some data
docker compose -f docker-compose-pmm-psmdb.yml exec -T psmdb-server mgodatagen -f /etc/datagen/replicaset.json --username=pmm_mongodb --password="5M](Q%q/U+YQ<^m" --host psmdb-server --port 27017 --tlsCertificateKeyFile=/mongodb_certs/client.pem --tlsCAFile=/mongodb_certs/ca-certs.pem

tests=${TESTS:-yes}
if [ $tests = "yes" ]; then
    echo "running tests"
    output=$(docker compose -f docker-compose-pmm-psmdb.yml run test pytest -s --verbose test.py)
    else
    echo "skipping tests"
fi

cleanup=${CLEANUP:-yes}
if [ $cleanup = "yes" ]; then
    echo "cleanup"
    docker compose -f docker-compose-pmm-psmdb.yml down -v --remove-orphans
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
