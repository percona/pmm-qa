#!/bin/bash

set -e

PWD=$(pwd) docker-compose -f docker-compose-mongo-replica.yml up -d

sleep 10
docker cp setup-replica.js mongors1:/
docker exec -u 0 mongors1 mongosh --port=27027 --authenticationDatabase admin -u dba -p secret setup-replica.js

# Install and run PBM
docker exec -u 0 mongors1 /bin/bash -c "percona-release enable pbm release && yum -y install percona-backup-mongodb"
docker exec -u 0 mongors2 /bin/bash -c "percona-release enable pbm release && yum -y install percona-backup-mongodb"
docker exec -u 0 mongors3 /bin/bash -c "percona-release enable pbm release && yum -y install percona-backup-mongodb"

docker exec  -d mongors1 /bin/bash -c 'PBM_MONGODB_URI="mongodb://pbmuser:secretpwd@localhost:27027" pbm-agent'
docker exec  -d mongors2 /bin/bash -c 'PBM_MONGODB_URI="mongodb://pbmuser:secretpwd@localhost:27028" pbm-agent'
docker exec  -d mongors3 /bin/bash -c 'PBM_MONGODB_URI="mongodb://pbmuser:secretpwd@localhost:27029" pbm-agent'

sudo -- sh -c "echo '127.0.0.1 mongors1 mongors2 mongors3' >> /etc/hosts"
