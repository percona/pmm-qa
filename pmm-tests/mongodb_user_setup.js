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
  roles: []
})

db.getSiblingDB("admin").createUser({
  user: "pmm_mongodb",
  pwd: "GRgrO9301RuF",
  roles: [
    { role: "explainRole", db: "admin" },
    { role: "clusterMonitor", db: "admin" },
    { role: "read", db: "local" }
  ]
})
