#!/bin/bash

## Slowlog file shared with ps docker container, to allow pmm-agent to read
sudo chmod 777 -R /tmp/mysql/log

## setup as we do in pmm-framework
docker exec pmm-agent_mysql_5_7 mysql -h 127.0.0.1 -u root -p^O6VrIoC1@9b -e "SET GLOBAL slow_query_log='ON';"
docker exec pmm-agent_mysql_5_7 mysql -h 127.0.0.1 -u root -p^O6VrIoC1@9b -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_AUDIT SONAME 'query_response_time.so';"
docker exec pmm-agent_mysql_5_7 mysql -h 127.0.0.1 -u root -p^O6VrIoC1@9b -e "INSTALL PLUGIN QUERY_RESPONSE_TIME SONAME 'query_response_time.so';"
docker exec pmm-agent_mysql_5_7 mysql -h 127.0.0.1 -u root -p^O6VrIoC1@9b -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_READ SONAME 'query_response_time.so';"
docker exec pmm-agent_mysql_5_7 mysql -h 127.0.0.1 -u root -p^O6VrIoC1@9b -e "INSTALL PLUGIN QUERY_RESPONSE_TIME_WRITE SONAME 'query_response_time.so';"
docker exec pmm-agent_mysql_5_7 mysql -h 127.0.0.1 -u root -p^O6VrIoC1@9b -e "SET GLOBAL query_response_time_stats=ON;"
docker exec pmm-agent_mysql_5_7 mysql -h 127.0.0.1 -u root -p^O6VrIoC1@9b -e "GRANT SELECT, PROCESS, REPLICATION CLIENT, RELOAD ON *.* TO 'pmm-agent'@'%';"
