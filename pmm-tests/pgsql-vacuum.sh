#!/bin/bash

export DOCKER_CONTAINER_NAME=pgsql_vacuum_db
export PGSQL_VACUUM_VERSION="latest"
echo "Setting up Postgres for vacuum monitoring"
if [ ! -z $@ ]; then
    PGSQL_VACUUM_VERSION=$1
fi  
docker stop pgsql_vacuum_db || true
docker rm pgsql_vacuum_db || true
docker run --name pgsql_vacuum_db -p 7432:5432 -e POSTGRES_PASSWORD=YIn7620U1SUc -d postgres:$PGSQL_VACUUM_VERSION \
    -c shared_preload_libraries='pg_stat_statements' -c pg_stat_statements.max=10000 -c pg_stat_statements.track=all
sleep 20
# --network pmm-qa \
docker exec pgsql_vacuum_db apt-get update
docker exec pgsql_vacuum_db apt-get install -y wget unzip
docker exec pgsql_vacuum_db wget https://www.postgresqltutorial.com/wp-content/uploads/2019/05/dvdrental.zip
docker exec pgsql_vacuum_db unzip dvdrental.zip
docker exec pgsql_vacuum_db psql -U postgres -c "CREATE EXTENSION pg_stat_statements;"
docker exec pgsql_vacuum_db psql -U postgres -c 'create database dvdrental;'
docker exec pgsql_vacuum_db pg_restore -U postgres -d dvdrental dvdrental.tar

## Prepare Data with 1000 tables and each table having around 10k records
## Get 10000 Rows into Testing Table, Import the sample Database
rm dvdrental.tar.xz || true
rm dvdrental.sql || true
wget https://github.com/percona/pmm-qa/raw/PMM-10244-2/pmm-tests/postgres/SampleDB/dvdrental.tar.xz
tar -xvf dvdrental.tar.xz ## only works on Linux/Mac based OS
docker cp dvdrental.sql pgsql_vacuum_db:/
docker exec pgsql_vacuum_db psql -d dvdrental -f dvdrental.sql -U postgres

pmm-admin add postgresql --username=postgres --password=YIn7620U1SUc pgsql_vacuum_db localhost:7432

## Update & Delete tables using a while loop with sleep
j=0
while [ $j -lt 3 ]
do
    export LENGTH=$(shuf -i 100-120 -n 1)
    export LENGTH_NEW=$(shuf -i 100-120 -n 1)
    export TABLE=$(shuf -i 1-1000 -n 1)
    export COUNT=$(docker exec pgsql_vacuum_db psql -U postgres -d dvdrental -c "select count(*) from film_testing_${TABLE} where length=${LENGTH};" | tail -3 | head -1 | xargs)
    docker exec pgsql_vacuum_db psql -U postgres -d dvdrental -c "delete from film_testing_${TABLE} where length=${LENGTH};"
    i=0
    while [ "$i" -le ${COUNT} ]; do
        docker exec pgsql_vacuum_db psql -U postgres -d dvdrental -c "insert into film_testing_${TABLE} values (${i}, 'title for ${i}', 'Description for ${i}', ${LENGTH});"
        i=$(( i + 1 ))
    done 
    docker exec pgsql_vacuum_db psql -U postgres -d dvdrental -c "update film_testing_${TABLE} set length=${LENGTH_NEW} where length=${LENGTH};"
    sleep 5
    j=$(( j + 1 ))
done
