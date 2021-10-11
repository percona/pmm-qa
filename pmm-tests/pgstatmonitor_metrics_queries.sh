#!/bin/bash

export PDPGSQL_CONTAINER=$1
db=1
docker exec ${PDPGSQL_CONTAINER} mkdir /tmp/sql
pushd pg_stat_monitor/regression/sql/
for filename in *.sql; do
    docker exec ${PDPGSQL_CONTAINER} bash -c "psql -h localhost -U postgres -c 'create database test${db}'"
    docker cp ${filename} ${PDPGSQL_CONTAINER}:/tmp/sql
    docker exec -u postgres ${PDPGSQL_CONTAINER} psql test${db} postgres -f /tmp/sql/${filename}
    ((db++))
done
popd
