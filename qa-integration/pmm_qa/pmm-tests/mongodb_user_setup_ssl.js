db = db.getSiblingDB("admin");
db.createRole({
    "role": "pbmAnyAction",
    "privileges": [{
        "resource": { "anyResource": true },
        "actions": [ "anyAction" ]
        }],
    "roles": []
});
db.createRole({
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
db.createRole({
     role: "cn=readers,ou=groups,dc=example,dc=org",
     privileges: [],
     roles: [
       { role: "explainRole", db: "admin" },
       { role: "clusterMonitor", db: "admin" },
       { role: "userAdminAnyDatabase", db: "admin" },
       { role: "dbAdminAnyDatabase", db: "admin" },
       { role: "readWriteAnyDatabase", db: "admin" },
       { role: "read", db: "local" }]
});
db.createUser({
   user: "pmm_mongodb",
   pwd: "5M](Q%q/U+YQ<^m",
   roles: [
      { role: "explainRole", db: "admin" },
      { role: "clusterMonitor", db: "admin" },
      { role: "userAdminAnyDatabase", db: "admin" },
      { role: "dbAdminAnyDatabase", db: "admin" },
      { role: "readWriteAnyDatabase", db: "admin" },
      { role: "read", db: "local" }
   ]
});
db.createUser({
    user: "pbm",
    pwd: "pbmpass",
    "roles" : [
        { "db" : "admin", "role" : "readWrite", "collection": "" },
        { "db" : "admin", "role" : "backup" },
        { "db" : "admin", "role" : "clusterMonitor" },
        { "db" : "admin", "role" : "restore" },
        { "db" : "admin", "role" : "pbmAnyAction" }
    ]
});
