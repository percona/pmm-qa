#!/bin/bash

docker exec pmm-agent_mysql_8_0 mysql -h 127.0.0.1 -u root -p^O6VrIoC1@9b -e "SET GLOBAL slow_query_log='ON';"
docker exec pmm-agent_mysql_8_0 mysql -h 127.0.0.1 -u root -p^O6VrIoC1@9b -e "GRANT SELECT, PROCESS, REPLICATION CLIENT, RELOAD, BACKUP_ADMIN ON *.* TO 'pmm-agent'@'%';"
