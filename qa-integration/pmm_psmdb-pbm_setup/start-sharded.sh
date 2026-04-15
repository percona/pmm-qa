#!/bin/bash
set -ex
pmm_user=${PMM_USER:-pmm}
pmm_pass=${PMM_PASS:-pmmpass}
pbm_user=${PBM_USER:-pbm}
pbm_pass=${PBM_PASS:-pbmpass}

docker compose -f docker-compose-sharded.yaml down -v --remove-orphans
docker compose -f docker-compose-sharded.yaml build
docker compose -f docker-compose-sharded.yaml up -d

echo "waiting 30 seconds for pmm-server to start"
sleep 30
echo "configuring pmm-server"
docker compose -f docker-compose-sharded.yaml exec -T pmm-server change-admin-password password
echo "restarting pmm-server"
docker compose -f docker-compose-sharded.yaml restart pmm-server
echo "waiting 30 seconds for pmm-server to start"
sleep 30

nodes="rs101 rs201"
for node in $nodes
do
    rs=$(echo $node | awk -F "0" '{print $1}')
    echo "configuring replicaset ${rs} with members priorities"
    docker compose -f docker-compose-sharded.yaml exec -T $node mongo --quiet << EOF
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
    docker compose -f docker-compose-sharded.yaml exec -T $node mongo --quiet << EOF
        db.getSiblingDB("admin").createUser({ user: "root", pwd: "root", roles: [ "root", "userAdminAnyDatabase", "clusterAdmin" ] });
EOF
    echo
    echo "configuring pbm and pmm roles on replicaset $rs"
    docker compose -f docker-compose-sharded.yaml exec -T $node mongo "mongodb://root:root@localhost/?replicaSet=${rs}" --quiet << EOF
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
    docker compose -f docker-compose-sharded.yaml exec -T $node mongo "mongodb://root:root@localhost/?replicaSet=${rs}" --quiet << EOF
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
    docker compose -f docker-compose-sharded.yaml exec -T $node mongo "mongodb://root:root@localhost/?replicaSet=${rs}" --quiet << EOF
    db.getSiblingDB("admin").createUser({
        user: "${pmm_user}",
        pwd: "${pmm_pass}",
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
docker compose -f docker-compose-sharded.yaml exec -T rscfg01 mongo --quiet << EOF
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
docker compose -f docker-compose-sharded.yaml exec -T mongos mongo --quiet << EOF
db.getSiblingDB("admin").createUser({ user: "root", pwd: "root", roles: [ "root", "userAdminAnyDatabase", "clusterAdmin" ] });
EOF
docker compose -f docker-compose-sharded.yaml exec -T mongos mongo "mongodb://root:root@localhost" --quiet --eval 'sh.addShard( "rs1/rs101:27017,rs102:27017,rs103:27017" )'
echo
sleep 20
docker compose -f docker-compose-sharded.yaml exec -T mongos mongo "mongodb://root:root@localhost" --quiet --eval 'sh.addShard( "rs2/rs201:27017,rs202:27017,rs203:27017" )'
echo
sleep 20
echo
echo "configuring pbm and pmm roles"
docker compose -f docker-compose-sharded.yaml exec -T mongos mongo "mongodb://root:root@localhost" --quiet << EOF
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
docker compose -f docker-compose-sharded.yaml exec -T mongos mongo "mongodb://root:root@localhost" --quiet << EOF
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
docker compose -f docker-compose-sharded.yaml exec -T mongos mongo "mongodb://root:root@localhost" --quiet << EOF
db.getSiblingDB("admin").createUser({
    user: "${pmm_user}",
    pwd: "${pmm_pass}",
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
    docker compose -f docker-compose-sharded.yaml exec -T $node bash -c "echo \"PBM_MONGODB_URI=mongodb://${pbm_user}:${pbm_pass}@127.0.0.1:27017\" > /etc/sysconfig/pbm-agent"
    echo "restarting pbm agent on $node"
    docker compose -f docker-compose-sharded.yaml exec -T $node systemctl restart pbm-agent
done
echo
echo "configuring pmm agents"
random_number=$RANDOM
nodes="rs101 rs102 rs103 rs201 rs202 rs203 rscfg01 rscfg02 rscfg03"
for node in $nodes
do
    echo "congiguring pmm agent on $node"
    rs=$(echo $node | awk -F "0" '{print $1}')
    docker compose -f docker-compose-sharded.yaml exec -T -e PMM_AGENT_SETUP_NODE_NAME=${node}_${random_number} $node pmm-agent setup
    docker compose -f docker-compose-sharded.yaml exec -T $node pmm-admin add mongodb --agent-password=mypass --cluster=sharded --environment=mongo-sharded-dev --username=${pmm_user} --password=${pmm_pass} ${node}_${random_number} 127.0.0.1:27017
done
echo "configuring pmm-agent on primary rscfg01 for mongos instance"
docker compose -f docker-compose-sharded.yaml exec -T rscfg01 pmm-admin add mongodb --agent-password=mypass --cluster=sharded --environment=mongo-sharded-dev --username=${pmm_user} --password=${pmm_pass} mongos_${random_number} mongos:27017

echo "adding some data"
docker compose -f docker-compose-sharded.yaml exec -T mongos mgodatagen -f /etc/datagen/sharded.json --uri=mongodb://root:root@127.0.0.1:27017
tests=${TESTS:-yes}
if [ $tests != "no" ]; then
    echo "running tests"
    docker compose -f docker-compose-sharded.yaml run test pytest -s -x --verbose test.py
    docker compose -f docker-compose-sharded.yaml run test chmod -R 777 .
    else
    echo "skipping tests"
fi
cleanup=${CLEANUP:-yes}
if [ $cleanup != "no" ]; then
    echo "cleanup"
    docker compose -f docker-compose-sharded.yaml down -v --remove-orphans
    else
    echo "skipping cleanup"
fi
