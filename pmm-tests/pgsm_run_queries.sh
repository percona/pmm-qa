#!/bin/sh

## Running Queries
wget https://raw.githubusercontent.com/percona/pmm-agent/pmm-2.26.0/testqueries/postgres/pg_stat_monitor_load.sql
while true
do
  su postgres bash -c 'psql -d contrib_regression -f pg_stat_monitor_load.sql'
  sleep 30
done