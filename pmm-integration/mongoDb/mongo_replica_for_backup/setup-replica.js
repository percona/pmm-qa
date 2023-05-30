rs.initiate(
  {
    _id: 'rs0',
    members: [
      { _id: 0, host: 'mo-replica-integration-0:27017', priority: 500 },
      { _id: 1, host: 'mo-replica-integration-1:27017' },
      { _id: 2, host: 'mo-replica-integration-2:27017' },
    ]
  });

sleep(40000);

db.getSiblingDB('admin').createUser(
  {
    user: 'admin',
    pwd: 'password',
    roles: [{ role: 'userAdminAnyDatabase', db: 'admin' },
    { role: 'dbAdminAnyDatabase', db: 'admin' },
    { role: 'readWriteAnyDatabase', db: 'admin' }],
  });

db.getSiblingDB('admin').createRole({
  'role': 'pbmAnyAction',
  'privileges': [
    {
      'resource': { 'anyResource': true },
      'actions': ['anyAction']
    }
  ],
  'roles': []
});

db.getSiblingDB('admin').createUser({
  user: 'pbmuser',
  'pwd': 'secretpwd',
  'roles': [
    { 'db': 'admin', 'role': 'readWrite', 'collection': '' },
    { 'db': 'admin', 'role': 'backup' },
    { 'db': 'admin', 'role': 'clusterMonitor' },
    { 'db': 'admin', 'role': 'restore' },
    { 'db': 'admin', 'role': 'pbmAnyAction' }
  ]
});

db.e2e.insert({ number: 1, name: 'John' })
db.e2e.find().pretty()
