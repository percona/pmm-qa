#!/bin/bash
set -euo pipefail

# shellcheck source=../scripts/lib/cursor-vm.sh
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../scripts/lib/cursor-vm.sh"
cursor_vm_apply
source "$(dirname "$0")/scripts/compose-env.sh"

pmm_mongo_user=${PMM_MONGO_USER:-${PMM_USER:-pmm}}
pmm_mongo_user_pass=${PMM_MONGO_USER_PASS:-${PMM_PASS:-pmmpass}}
pbm_user=${PBM_USER:-pbm}
pbm_pass=${PBM_PASS:-pbmpass}

docker network create qa-integration 2>/dev/null || true
docker network create pmm-qa 2>/dev/null || true
docker network create pmm-ui-tests_pmm-network 2>/dev/null || true
docker network create pmm2-upgrade-tests_pmm-network 2>/dev/null || true
docker network create pmm2-ui-tests_pmm-network 2>/dev/null || true

compose_sharded down -v --remove-orphans
compose_sharded build
compose_sharded up -d

echo
echo "waiting 60 seconds for replica set members to start"
sleep 60
echo
nodes="rs101 rs201"
for node in $nodes
do
    rs=$(echo $node | awk -F "0" '{print $1}')
    echo "configuring replicaset ${rs} with members priorities"
    compose_sharded exec -T $node mongo --quiet << EOF
        config = {
            "_id" : "${rs}",
            "members" : [
            {
                "_id" : 0,
                "host" : "${rs}01:27017",
                "priority": 2
            },
            {
                "_id" : 1,
                "host" : "${rs}02:27017",
                "priority": 1
            },
            {
                "_id" : 2,
                "host" : "${rs}03:27017",
                "priority": 1
            }
          ]
          };
          rs.initiate(config);
EOF
    sleep 60
    echo
    echo "configuring root user on primary $node replicaset $rs"
    compose_sharded exec -T $node mongo --quiet << EOF
        db.getSiblingDB("admin").createUser({ user: "root", pwd: "root", roles: [ "root", "userAdminAnyDatabase", "clusterAdmin" ] });
EOF
    echo
    echo "configuring pbm and pmm roles on replicaset $rs"
    compose_sharded exec -T $node mongo "mongodb://root:root@localhost/?replicaSet=${rs}" --quiet << EOF
    db.getSiblingDB("admin").createRole({
        "role": "pbmAnyAction",
        "privileges": [{
            "resource": { "anyResource": true },
	    "actions": [ "anyAction" ]
            }],
        "roles": []
    });
    db.getSiblingDB("admin").createRole({
        role: "explainRole",
        privileges: [{
            resource: {
                db: "",
                collection: ""
                },
            actions: [
                "listIndexes",
                "listCollections",
                "dbStats",
                "dbHash",
                "collStats",
                "find"
                ]
            }],
        roles:[]
    });
EOF
    echo
    echo "creating pbm user for replicaset ${rs}"
    compose_sharded exec -T $node mongo "mongodb://root:root@localhost/?replicaSet=${rs}" --quiet << EOF
    db.getSiblingDB("admin").createUser({
        user: "${pbm_user}",
        pwd: "${pbm_pass}",
        "roles" : [
            { "db" : "admin", "role" : "readWrite", "collection": "" },
            { "db" : "admin", "role" : "backup" },
            { "db" : "admin", "role" : "clusterMonitor" },
            { "db" : "admin", "role" : "restore" },
            { "db" : "admin", "role" : "pbmAnyAction" }
        ]
    });
EOF
    echo
    echo "creating pmm user for replicaset ${rs}"
    compose_sharded exec -T $node mongo "mongodb://root:root@localhost/?replicaSet=${rs}" --quiet << EOF
    db.getSiblingDB("admin").createUser({
        user: "${pmm_mongo_user}",
        pwd: "${pmm_mongo_user_pass}",
        roles: [
            { role: "explainRole", db: "admin" },
            { role: "clusterMonitor", db: "admin" },
            { role: "read", db: "local" },
            { "db" : "admin", "role" : "readWrite", "collection": "" },
            { "db" : "admin", "role" : "backup" },
            { "db" : "admin", "role" : "clusterMonitor" },
            { "db" : "admin", "role" : "restore" },
            { "db" : "admin", "role" : "pbmAnyAction" }
        ]
    });
EOF
done

echo "configuring configserver replicaset with members priorities"
compose_sharded exec -T rscfg01 mongo --quiet << EOF
    config = {
        "_id" : "rscfg",
        "members" : [
        {
            "_id" : 0,
            "host" : "rscfg01:27017",
            "priority": 2
        },
        {
            "_id" : 1,
            "host" : "rscfg02:27017",
            "priority": 1
        },
        {
            "_id" : 2,
            "host" : "rscfg03:27017",
            "priority": 1
        }
      ]
      };
      rs.initiate(config);
EOF
sleep 60
echo
echo "adding shards and creating global mongo user"
compose_sharded exec -T mongos mongo --quiet << EOF
db.getSiblingDB("admin").createUser({ user: "root", pwd: "root", roles: [ "root", "userAdminAnyDatabase", "clusterAdmin" ] });
EOF
compose_sharded exec -T mongos mongo "mongodb://root:root@localhost" --quiet --eval 'sh.addShard( "rs1/rs101:27017,rs102:27017,rs103:27017" )'
echo
sleep 20
compose_sharded exec -T mongos mongo "mongodb://root:root@localhost" --quiet --eval 'sh.addShard( "rs2/rs201:27017,rs202:27017,rs203:27017" )'
echo
sleep 20
echo
echo "configuring pbm and pmm roles"
compose_sharded exec -T mongos mongo "mongodb://root:root@localhost" --quiet << EOF
db.getSiblingDB("admin").createRole({
    "role": "pbmAnyAction",
    "privileges": [{
        "resource": { "anyResource": true },
         "actions": [ "anyAction" ]
        }],
    "roles": []
});
db.getSiblingDB("admin").createRole({
    role: "explainRole",
    privileges: [{
        resource: {
            db: "",
            collection: ""
            },
        actions: [
            "listIndexes",
            "listCollections",
            "dbStats",
            "dbHash",
            "collStats",
            "find"
            ]
        }],
    roles:[]
});
EOF
echo
echo "creating pbm user"
compose_sharded exec -T mongos mongo "mongodb://root:root@localhost" --quiet << EOF
db.getSiblingDB("admin").createUser({
    user: "${pbm_user}",
    pwd: "${pbm_pass}",
    "roles" : [
        { "db" : "admin", "role" : "readWrite", "collection": "" },
        { "db" : "admin", "role" : "backup" },
        { "db" : "admin", "role" : "clusterMonitor" },
        { "db" : "admin", "role" : "restore" },
        { "db" : "admin", "role" : "pbmAnyAction" }
    ]
});
EOF
echo
echo "creating pmm user"
compose_sharded exec -T mongos mongo "mongodb://root:root@localhost" --quiet << EOF
db.getSiblingDB("admin").createUser({
    user: "${pmm_mongo_user}",
    pwd: "${pmm_mongo_user_pass}",
    roles: [
        { role: "explainRole", db: "admin" },
        { role: "clusterMonitor", db: "admin" },
        { role: "read", db: "local" },
        { "db" : "admin", "role" : "readWrite", "collection": "" },
        { "db" : "admin", "role" : "backup" },
        { "db" : "admin", "role" : "clusterMonitor" },
        { "db" : "admin", "role" : "restore" },
        { "db" : "admin", "role" : "pbmAnyAction" }
    ]
});
EOF


echo
echo "configuring pbm agents"
nodes="rs101 rs102 rs103 rs201 rs202 rs203 rscfg01 rscfg02 rscfg03"
for node in $nodes
do
    echo "congiguring pbm agent on $node"
    compose_sharded exec -T $node bash -c "echo \"PBM_MONGODB_URI=mongodb://${pbm_user}:${pbm_pass}@127.0.0.1:27017\" > /etc/sysconfig/pbm-agent"
    echo "restarting pbm agent on $node"
    compose_sharded exec -T $node systemctl restart pbm-agent
done
echo
echo "configuring pmm agents"
random_number=$RANDOM
nodes="rs101 rs102 rs103 rs201 rs202 rs203 rscfg01 rscfg02 rscfg03"
for node in $nodes
do
    echo "configuring pmm agent on $node"
    rs=$(echo $node | awk -F "0" '{print $1}')
    compose_sharded exec -T $node /entrypoint-no-systemd.sh start-pmm-agent
    sleep 2
    compose_sharded exec -T -e PMM_AGENT_SETUP_NODE_NAME=${node}._${random_number} $node pmm-agent setup
    compose_sharded exec -T $node pmm-admin add mongodb --enable-all-collectors --agent-password=mypass --environment=mongo-sharded-dev --cluster=sharded --replication-set=${rs} --username=${pmm_mongo_user} --password=${pmm_mongo_user_pass} --host=${node} --port=27017 ${node}_${random_number}
done
echo "configuring pmm-agent on primary rscfg01 for mongos instance"
compose_sharded exec -T rscfg01 pmm-admin add mongodb --enable-all-collectors --agent-password=mypass --environment=mongo-sharded-dev --cluster=sharded --username=${pmm_mongo_user} --password=${pmm_mongo_user_pass} --host=mongos --port=27017 mongos_${random_number}

echo "adding some data"
compose_sharded exec -T mongos mgodatagen -f /etc/datagen/sharded.json --uri=mongodb://root:root@127.0.0.1:27017
tests=${TESTS:-yes}
if [ $tests != "no" ]; then
    echo "running tests"
    compose_sharded run test pytest -s -x --verbose test.py
    compose_sharded run test chmod -R 777 .
    else
    echo "skipping tests"
fi
cleanup=${CLEANUP:-yes}
if [ $cleanup != "no" ]; then
    echo "cleanup"
    compose_sharded down -v --remove-orphans
    else
    echo "skipping cleanup"
fi
