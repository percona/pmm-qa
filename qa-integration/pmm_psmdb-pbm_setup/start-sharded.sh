#!/bin/bash
set -e

source "$(dirname "${BASH_SOURCE[0]}")/wait-for-pmm-agent.sh"

pmm_mongo_user=${PMM_MONGO_USER:-${PMM_USER:-pmm}}
pmm_mongo_user_pass=${PMM_MONGO_USER_PASS:-${PMM_PASS:-pmmpass}}
pbm_user=${PBM_USER:-pbm}
pbm_pass=${PBM_PASS:-pbmpass}

docker network create qa-integration || true
docker network create pmm-qa || true
docker network create pmm-ui-tests_pmm-network || true
docker network create pmm2-upgrade-tests_pmm-network || true
docker network create pmm2-ui-tests_pmm-network || true

# Start minio (the "minio" compose profile) unless MINIO=false. When enabled,
# start our own only if no other setup is already running one.
minio=${MINIO:-true}
minio=${minio,,}
if [ "$minio" != "false" ]; then
    if docker ps -a --filter name=minio --format '{{.Names}}' | grep -qx minio; then
        echo "minio container exists, reusing it"
    else
        COMPOSE_PROFILES="${COMPOSE_PROFILES:+$COMPOSE_PROFILES,}minio"
    fi
else
    echo "skipping minio container (MINIO=false)"
fi
export COMPOSE_PROFILES

docker compose -f docker-compose-sharded.yaml down -v --remove-orphans
docker compose -f docker-compose-sharded.yaml build

# The "test" service lives in docker-compose-test.yaml and is merged in only for
# the TESTS=yes run below, so `up` here can never create the fixed-name "test"
# container that would clash across the parallel PSMDB stacks.
docker compose -f docker-compose-sharded.yaml up -d

echo
echo "waiting 60 seconds for replica set members to start"
sleep 60
echo
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
echo "configuring root user on primary rscfg01 configserver replicaset"
docker compose -f docker-compose-sharded.yaml exec -T rscfg01 mongo --quiet << EOF
    db.getSiblingDB("admin").createUser({ user: "root", pwd: "root", roles: [ "root", "userAdminAnyDatabase", "clusterAdmin" ] });
EOF
echo
echo "configuring pbm and pmm roles on configserver replicaset rscfg"
docker compose -f docker-compose-sharded.yaml exec -T rscfg01 mongo "mongodb://root:root@localhost/?replicaSet=rscfg" --quiet << EOF
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
echo "creating pbm user for configserver replicaset rscfg"
docker compose -f docker-compose-sharded.yaml exec -T rscfg01 mongo "mongodb://root:root@localhost/?replicaSet=rscfg" --quiet << EOF
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
echo "creating pmm user for configserver replicaset rscfg"
docker compose -f docker-compose-sharded.yaml exec -T rscfg01 mongo "mongodb://root:root@localhost/?replicaSet=rscfg" --quiet << EOF
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
    echo "configuring pmm agent on $node"
    rs=$(echo $node | awk -F "0" '{print $1}')
    docker compose -f docker-compose-sharded.yaml exec -T -e PMM_AGENT_SETUP_NODE_NAME=${node}._${random_number} $node pmm-agent setup
    wait_for_pmm_agent docker-compose-sharded.yaml "$node"
    docker compose -f docker-compose-sharded.yaml exec -T $node pmm-admin add mongodb --enable-all-collectors --agent-password=mypass --environment=mongo-sharded-dev --cluster=sharded --replication-set=${rs} --username=${pmm_mongo_user} --password=${pmm_mongo_user_pass} --host=${node} --port=27017 ${node}_${random_number}
done

# Enable FTDC on the mongos so it exposes the serverStatus (mongodb_ss_*) metric family.
# A mongos has no dbpath, so FTDC has no default diagnostic.data directory and starts
# DISABLED -- and it refuses to enable until diagnosticDataCollectionDirectoryPath is set
# ("FTDC cannot be enabled without setting the set parameter 'diagnosticDataCollectionDirectoryPath'
# first"). The PMM exporter reads serverStatus out of getDiagnosticData, so without this the
# MongoDB Router Summary serverStatus panels (Command Operations, Connections, Latencies,
# Queued Operations, Reads & Writes) stay empty. Give FTDC a writable dir, then enable it
# (order matters). Doing it at runtime here because the config-file setParameter is applied
# before the dir exists and silently leaves FTDC off.
echo "enabling FTDC on the mongos (needed for mongodb_ss_* / Router Summary)"
docker compose -f docker-compose-sharded.yaml exec -T mongos bash -c 'mkdir -p /var/lib/mongo/mongos.diagnostic.data && chown -R mongod:mongod /var/lib/mongo/mongos.diagnostic.data'
docker compose -f docker-compose-sharded.yaml exec -T mongos mongo "mongodb://root:root@localhost/admin" --quiet --eval 'db.adminCommand({setParameter:1, diagnosticDataCollectionDirectoryPath:"/var/lib/mongo/mongos.diagnostic.data"}); db.adminCommand({setParameter:1, diagnosticDataCollectionEnabled:true});'

echo "configuring pmm-agent on mongos instance"
docker compose -f docker-compose-sharded.yaml exec -T -e PMM_AGENT_SETUP_NODE_NAME=mongos_${random_number} mongos pmm-agent setup
# On the mongos, disable ONLY the indexstats collector. Against a router $indexStats runs on
# SHARDED collections and returns one row per shard per index; the exporter labels them only
# by (database, collection, key_name) with no shard label, so the two shards produce duplicate
# series ("... was collected before with the same name and label values"), which spams the
# pmm-agent log every scrape and drops the indexstats family (index access stats are
# meaningless on a router anyway). Keep collstats/dbstats enabled -- they do NOT duplicate,
# and dbstats provides mongodb_dbstats_fsUsedSize/fsTotalSize, which the "Disk Space
# Utilization" gauge on the Router Summary needs. The shard mongod services keep
# --enable-all-collectors; they don't hit the indexstats duplicate because each shard only
# sees its own chunks.
docker compose -f docker-compose-sharded.yaml exec -T mongos pmm-admin add mongodb --enable-all-collectors --disable-collectors=indexstats --agent-password=mypass --environment=mongo-sharded-dev --cluster=sharded --username=${pmm_mongo_user} --password=${pmm_mongo_user_pass} mongos_${random_number} 127.0.0.1:27017

echo "adding some data"
docker compose -f docker-compose-sharded.yaml exec -T mongos mgodatagen -f /etc/datagen/sharded.json --uri=mongodb://root:root@127.0.0.1:27017

echo "writing chunk-activity generator so the chunk-move/split dashboards keep getting data"
docker compose -f docker-compose-sharded.yaml exec -T mongos tee /tmp/keep_chunks_moving.js > /dev/null << 'JSEOF'
var shards = db.getSiblingDB("config").shards.find().toArray().map(function (s) { return s._id; });
var ins = db.getSiblingDB("test").test.insertOne({ ts: new Date() });
shards.forEach(function (target) {
    try {
        sh.moveChunk("test.test", { _id: ins.insertedId }, target);
    } catch (e) {
        print("moveChunk to " + target + " failed, skipping: " + e);
    }
});
try {
    sh.splitFind("test.test", { _id: ins.insertedId });
} catch (e) {
    print("splitFind failed, skipping: " + e);
}
JSEOF
docker compose -f docker-compose-sharded.yaml exec -T mongos tee /tmp/keep_chunks_moving.sh > /dev/null << 'SHEOF'
#!/bin/bash
while true; do
    mongo "mongodb://root:root@localhost" --quiet /tmp/keep_chunks_moving.js > /tmp/keep_chunks_moving.log 2>&1
    sleep 240
done
SHEOF
echo "starting background chunk-activity generator"
docker compose -f docker-compose-sharded.yaml exec -d mongos bash /tmp/keep_chunks_moving.sh


generate_traffic=${GENERATE_TRAFFIC:-yes}
if [ $generate_traffic != "no" ]; then
    echo "generating opcountersRepl traffic (insert/update/delete) against the sharded cluster"
    COMPOSE_FILE=docker-compose-sharded.yaml bash ./generate_opcountersrepl_traffic.sh
else
    echo "skipping opcountersRepl traffic generation"
fi

tests=${TESTS:-yes}
if [ $tests != "no" ]; then
    echo "running tests"
    docker compose -f docker-compose-sharded.yaml -f docker-compose-test.yaml --profile tests run --rm test pytest -s -x --verbose test.py
    docker compose -f docker-compose-sharded.yaml -f docker-compose-test.yaml --profile tests run --rm test chmod -R 777 .
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
