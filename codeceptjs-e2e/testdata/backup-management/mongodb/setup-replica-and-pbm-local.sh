#!/bin/bash

set -e

PWD=$(pwd) docker-compose -f docker-compose-mongo-replica-local.yml up -d

cat > setup-replica.js <<EOF
rs.initiate(
  {
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

  db.getSiblingDB("admin").createRole({ "role": "pbmAnyAction",
      "privileges": [
         { "resource": { "anyResource": true },
           "actions": [ "anyAction" ]
         }
      ],
      "roles": []
   });

  db.getSiblingDB("admin").createUser({user: "pbmuser",
       "pwd": "secretpwd",
       "roles" : [
          { "db" : "admin", "role" : "readWrite", "collection": "" },
          { "db" : "admin", "role" : "backup" },
          { "db" : "admin", "role" : "clusterMonitor" },
          { "db" : "admin", "role" : "restore" },
          { "db" : "admin", "role" : "pbmAnyAction" }
       ]
    });

  db.e2e.insert({number: 1, name: "John"})
  db.e2e.find().pretty()
EOF

sleep 10
docker cp setup-replica.js mongors1:/
docker exec -u 0 mongors1 mongo --port=27027 --authenticationDatabase admin setup-replica.js

# Install PBM 1.8.1
docker exec -u 0 mongors1 /bin/bash -c "percona-release enable pbm release && dnf -y install percona-backup-mongodb-1.8.1-1.el8"
docker exec -u 0 mongors2 /bin/bash -c "percona-release enable pbm release && dnf -y install percona-backup-mongodb-1.8.1-1.el8"
docker exec -u 0 mongors3 /bin/bash -c "percona-release enable pbm release && dnf -y install percona-backup-mongodb-1.8.1-1.el8"

docker exec  -d mongors1 /bin/bash -c 'PBM_MONGODB_URI="mongodb://pbmuser:secretpwd@localhost:27027" pbm-agent'
docker exec  -d mongors2 /bin/bash -c 'PBM_MONGODB_URI="mongodb://pbmuser:secretpwd@localhost:27028" pbm-agent'
docker exec  -d mongors3 /bin/bash -c 'PBM_MONGODB_URI="mongodb://pbmuser:secretpwd@localhost:27029" pbm-agent'

docker exec -u 0 -it pmm-client /bin/bash -c "dnf -y install https://repo.percona.com/yum/percona-release-latest.noarch.rpm"
docker exec -u 0 -it pmm-client /bin/bash -c "percona-release enable pbm release && dnf -y install percona-backup-mongodb-1.8.1-1.el8"
docker exec -u 0 -it pmm-client /bin/bash -c "pmm-admin add mongodb --service-name=mongo-backup-locations --username=admin --password=password --host=mongors1 --port=27027"
docker exec -u 0 -it pmm-client /bin/bash -c "pmm-admin add mongodb --service-name=mongo-backup-schedule --username=admin --password=password --host=mongors1 --port=27027"
docker exec -u 0 -it pmm-client /bin/bash -c "pmm-admin add mongodb --service-name=mongo-backup-inventory --username=admin --password=password --host=mongors1 --port=27027"
docker exec -u 0 -it pmm-client /bin/bash -c "pmm-admin add mongodb --service-name=mongo-service-to-delete --username=admin --password=password --host=mongors1 --port=27027"
