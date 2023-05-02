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