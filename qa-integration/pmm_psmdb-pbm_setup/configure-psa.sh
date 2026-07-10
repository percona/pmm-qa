#!/bin/bash
set -e

pmm_mongo_user=${PMM_MONGO_USER:-pmm}
pmm_mongo_user_pass=${PMM_MONGO_USER_PASS:-pmmpass}
pbm_user=${PBM_USER:-pbm}
pbm_pass=${PBM_PASS:-pbmpass}

echo
echo "configuring PSA replicaset with members priorities"
docker compose -f docker-compose-rs.yaml exec -T rs101 mongo --quiet << EOF
    config = {
        "_id" : "rs",
        "members" : [
        {
            "_id" : 0,
            "host" : "rs101:27017",
            "priority": 2
        },
        {
            "_id" : 1,
            "host" : "rs102:27017",
            "priority": 1
        },
        {
            "_id" : 2,
            "host" : "rs103:27017",
            "arbiterOnly": true
        }
      ]
      };
      rs.initiate(config);
EOF
echo
sleep 60
echo
echo "configuring root user on primary"
docker compose -f docker-compose-rs.yaml exec -T rs101 mongo --quiet << EOF
db.getSiblingDB("admin").createUser({ user: "root", pwd: "root", roles: [ "root", "userAdminAnyDatabase", "clusterAdmin" ] });
EOF
echo
echo "configuring pbm and pmm roles"
docker compose -f docker-compose-rs.yaml exec -T rs101 mongo "mongodb://root:root@localhost/?replicaSet=rs" --quiet << EOF
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
            // Negative test case: QAN-required actions removed
            // (originally: "listIndexes", "listCollections", "dbStats",
            //  "dbHash", "collStats", "find")
            "listCollections",
            ]
        }],
    roles:[]
});
// Negative test case: clusterMonitor grants find on system.profile in all
// databases, which is enough for QAN. This role mimics clusterMonitor for
// the exporter but withholds profiler access.
db.getSiblingDB("admin").createRole({
    role: "clusterMonitorNoProfile",
    privileges: [
        {
            resource: { cluster: true },
            actions: [
                "serverStatus", "replSetGetStatus", "replSetGetConfig",
                "getCmdLineOpts", "getLog", "getParameter", "hostInfo",
                "inprog", "listDatabases", "listSessions", "netstat",
                "top", "useUUID", "connPoolStats", "getShardMap",
                "listShards", "shardingState"
            ]
        },
        {
            resource: { db: "", collection: "" },
            actions: [ "collStats", "dbStats", "indexStats", "listCollections", "listIndexes" ]
        },
        {
            resource: { db: "local", collection: "" },
            actions: [ "find", "collStats", "dbStats", "listCollections", "listIndexes" ]
        }
    ],
    roles: []
});
EOF
echo
echo "creating pbm user"
docker compose -f docker-compose-rs.yaml exec -T rs101 mongo "mongodb://root:root@localhost/?replicaSet=rs" --quiet << EOF
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
docker compose -f docker-compose-rs.yaml exec -T rs101 mongo "mongodb://root:root@localhost/?replicaSet=rs" --quiet << EOF
db.getSiblingDB("admin").createUser({
    user: "${pmm_mongo_user}",
    pwd: "${pmm_mongo_user_pass}",
    roles: [
        // Negative test case: QAN-required roles removed.
        // backup/restore/readWrite/pbmAnyAction AND clusterMonitor all grant
        // "find" on system.profile, which lets QAN work even without explainRole.
        // (originally: explainRole, clusterMonitor, read@local,
        //  readWrite@admin, backup, clusterMonitor, restore, pbmAnyAction)
        { role: "explainRole", db: "admin" },
        { role: "clusterMonitorNoProfile", db: "admin" }
    ]
});
EOF
