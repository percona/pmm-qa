rs.initiate({
    _id : 'rs0',
    members: [
      { _id : 0, host : "mongors1:27027", priority: 500 },
      { _id : 1, host : "mongors2:27028" },
      { _id : 2, host : "mongors3:27029" }
    ]
  });
  sleep(40000);

  db.getSiblingDB("admin").createUser(
  {
    user: "admin",
    pwd: "password",
    roles: [ { role: "userAdminAnyDatabase", db: "admin" },
             { role: "dbAdminAnyDatabase", db: "admin" },
             { role: "readWriteAnyDatabase", db: "admin" } ]
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
  })

  db.getSiblingDB("admin").createRole({ "role": "pbmAnyAction",
      "privileges": [
         { "resource": { "anyResource": true },
           "actions": [ "anyAction" ]
         }
      ],
      "roles": []
   });

  db.getSiblingDB("admin").createUser({
     user: "pmm",
     pwd: "pmm",
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
  })

  db.getSiblingDB("admin").createUser({
        user : "pbmuser",
       "pwd": "secretpwd",
       "roles" : [
          { "db" : "admin", "role" : "readWrite", "collection": "" },
          { "db" : "admin", "role" : "backup" },
          { "db" : "admin", "role" : "clusterMonitor" },
          { "db" : "admin", "role" : "restore" },
          { "db" : "admin", "role" : "pbmAnyAction" }
       ]
    });

  db.e2e.insertOne({number: 1, name: "John"})
  db.e2e.find().pretty()
