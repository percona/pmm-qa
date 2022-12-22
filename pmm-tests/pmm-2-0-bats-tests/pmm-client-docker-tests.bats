#!/usr/bin/env bats

MYSQL_USER="root"
MYSQL_PASSWORD="root"

@test "run pmm-admin list on pmm-client docker container" {
run docker exec pmm-client pmm-admin list
echo "$output"
    [ "$status" -eq 0 ]
    [[ ${lines[0]} =~ "Service type" ]]
    [[ ${lines[1]} =~ "ps5.7" ]]
    [[ ${lines[2]} =~ "mongodb-4.0" ]]
    [[ ${lines[3]} =~ "postgres-10" ]]
    [[ ${lines[7]} =~ "Running" ]]
}

@test "run pmm-admin add mysql with default options" {
run docker exec pmm-client pmm-admin add mysql --username=root --password=root --service-name=ps5.7_2  --host=ps5.7 --port=3306 --server-url=http://admin:admin@docker-client-check-pmm-server/
echo "$output"
    [ "$status" -eq 0 ]
    [[ ${lines[0]} =~ "MySQL Service added." ]]
    [[ ${lines[2]} =~ "ps5.7_2" ]]
}

@test "run pmm-admin remove mysql" {
run docker exec pmm-client pmm-admin remove mysql ps5.7_2
echo "$output"
    [ "$status" -eq 0 ]
    [[ ${lines[0]} =~ "Service removed." ]]
}

@test "run pmm-admin add mongodb with default options" {
run docker exec pmm-client pmm-admin add mongodb --service-name=mongodb-4.0_2  --host=mongodb --port=27017 --server-url=http://admin:admin@docker-client-check-pmm-server/
echo "$output"
    [ "$status" -eq 0 ]
    [[ ${lines[0]} =~ "MongoDB Service added" ]]
    [[ ${lines[2]} =~ "mongodb-4.0_2" ]]
}

@test "run pmm-admin remove mongodb" {
run docker exec pmm-client pmm-admin remove mongodb mongodb-4.0_2
echo "$output"
    [ "$status" -eq 0 ]
    [[ ${lines[0]} =~ "Service removed." ]]
}

@test "run pmm-admin add postgresql with default options" {
run docker exec pmm-client pmm-admin add postgresql --username=postgres --password=postgres --service-name=postgres-10_2  --host=postgres-10 --port=5432 --server-url=http://admin:admin@docker-client-check-pmm-server/
echo "$output"
    [ "$status" -eq 0 ]
    [[ ${lines[0]} =~ "PostgreSQL Service added." ]]
    [[ ${lines[2]} =~ "postgres-10_2" ]]
}

@test "run pmm-admin remove postgresql" {
run docker exec pmm-client pmm-admin remove postgresql postgres-10_2
echo "$output"
    [ "$status" -eq 0 ]
    [[ ${lines[0]} =~ "Service removed." ]]
}

function teardown() {
    echo "$output"
}

