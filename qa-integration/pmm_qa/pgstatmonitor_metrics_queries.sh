#!/bin/bash

export PDPGSQL_CONTAINER=$1
db=1
docker exec ${PDPGSQL_CONTAINER} mkdir /tmp/sql
wget https://raw.githubusercontent.com/percona/pmm-agent/main/testqueries/postgres/pg_stat_monitor_load.sql
docker exec ${PDPGSQL_CONTAINER} bash -c "psql -h localhost -U postgres -c 'create database test1'"
docker cp pg_stat_monitor_load.sql ${PDPGSQL_CONTAINER}:/tmp/sql
while true
do
  docker exec -u postgres ${PDPGSQL_CONTAINER} psql test1 postgres -f /tmp/sql/pg_stat_monitor_load.sql
  sleep 30
done
