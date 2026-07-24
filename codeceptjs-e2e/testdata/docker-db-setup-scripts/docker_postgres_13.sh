#!/bin/bash

## Percona-distribution postgresql
docker exec pmm-agent_postgres psql -h localhost -U postgres -c 'create extension pg_stat_statements'
docker exec pmm-agent_postgres psql -h localhost -U postgres -c 'create extension pg_stat_monitor'
docker exec pmm-agent_postgres psql -h localhost -U postgres -c 'SELECT pg_reload_conf();'
