#!/usr/bin/env bats

MYSQL_USER="root"
MYSQL_PASSWORD="root"

@test "run pmm-admin list on pmm-client docker container" {
if [[ $(id -u) -eq 0 ]] ; then
        skip "Skipping this test, because you are running under root"
fi
run docker exec pmm-client pmm-admin list
echo "$output"
    [ "$status" -eq 0 ]
    [[ ${lines[0]} =~ "Service type  Service name Address and port Service ID" ]]
    [[ ${lines[1]} =~ "ps5.7" ]]
    [[ ${lines[4]} =~ "Running" ]]
}

@test "run pmm-admin add mysql with default options" {
if [[ $(id -u) -eq 0 ]] ; then
        skip "Skipping this test, because you are running under root"
fi
run docker exec pmm-client pmm-admin add mysql --username=root --password=root --service-name=ps5.7_2  --host=ps5.7 --port=3306 --server-url=http://admin:admin@pmm-server/
echo "$output"
    [ "$status" -eq 0 ]
    [[ ${lines[0]} =~ "MySQL Service added." ]]
    [[ ${lines[2]} =~ "ps5.7_2" ]]
}

@test "run pmm-admin remove mysql" {
if [[ $(id -u) -eq 0 ]] ; then
        skip "Skipping this test, because you are running under root"
fi
run docker exec pmm-client pmm-admin remove mysql ps5.7_2
echo "$output"
    [ "$status" -eq 0 ]
    [[ ${lines[0]} =~ "Service removed." ]]
}

function teardown() {
    echo "$output"
}

