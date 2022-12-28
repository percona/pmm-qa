#!/usr/bin/env bats

## proxysql


PROXYSQL_USER=""
PROXYSQL_PASSWORD=""
export PMM_SERVER_DOCKER_CONTAINER=$(docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}" | grep 'pmm-server' | awk '{print $3}')

@test "run pmm-admin add proxysql based on running intsances" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "ProxySQL" | awk -F" " '{print $3}') ; do
                echo "$i"
                let COUNTER=COUNTER+1
                ProxySQL_IP_PORT=${i}
                run docker exec pxc_container_5.7 pmm-admin add proxysql proxysql_$COUNTER ${ProxySQL_IP_PORT}
                echo "$output"
                [ "$status" -eq 0 ]
                echo "${lines[0]}" | grep "ProxySQL Service added."
        done
}


@test "run pmm-admin add proxysql again based on running instances" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "ProxySQL" | grep "proxysql_" | awk -F" " '{print $3}') ; do
                let COUNTER=COUNTER+1
                ProxySQL_IP_PORT=${i}
                run docker exec pxc_container_5.7 pmm-admin add proxysql proxysql_$COUNTER ${ProxySQL_IP_PORT}
                echo "$output"
                [ "$status" -eq 1 ]
                echo "${lines[0]}" | grep "already exists."
        done
}

@test "run pmm-admin remove proxysql" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "ProxySQL" | grep "proxysql_") ; do
                let COUNTER=COUNTER+1
                run docker exec pxc_container_5.7 pmm-admin remove proxysql proxysql_$COUNTER
                echo "$output"
                        [ "$status" -eq 0 ]
                        echo "${output}" | grep "Service removed."
        done
}


@test "run pmm-admin remove proxysql again" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "ProxySQL" ) ; do
                let COUNTER=COUNTER+1
                run docker exec pxc_container_5.7 pmm-admin remove proxysql proxysql_$COUNTER
                echo "$output"
                        [ "$status" -eq 1 ]
                        echo "${output}" | grep "not found."
        done
}

@test "PMM-T965 run pmm-admin add proxysql with --agent-password flag" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "ProxySQL" | grep "proxysql_" | awk -F" " '{print $3}') ; do
                let COUNTER=COUNTER+1
                ProxySQL_IP_PORT=${i}
                run docker exec pxc_container_5.7 pmm-admin add proxysql --agent-password=mypass proxysql_$COUNTER ${ProxySQL_IP_PORT}
                echo "$output"
                [ "$status" -eq 0 ]
                echo "${lines[0]}" | grep "ProxySQL Service added."
        done
}

@test "PMM-T965 check metrics from proxysql service with custom agent password" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "ProxySQL" | grep "proxysql_") ; do
            let COUNTER=COUNTER+1
            run sleep 20
            run sudo chmod +x ./pmm-tests/pmm-2-0-bats-tests/check_metric.sh
            run docker cp ./pmm-tests/pmm-2-0-bats-tests/check_metric.sh pxc_container_5.7:/
            run docker exec pxc_container_5.7 ./check_metric.sh proxysql_$COUNTER proxysql_up ${PMM_SERVER_DOCKER_CONTAINER} proxysql_exporter pmm mypass
            echo "$output"
            [ "$status" -eq 0 ]
            [ "${lines[0]}" = "proxysql_up 1" ]
        done
}

@test "run pmm-admin remove proxysql added with custom agent password" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "ProxySQL" | grep "proxysql_") ; do
                let COUNTER=COUNTER+1
                run docker exec pxc_container_5.7 pmm-admin remove proxysql proxysql_$COUNTER
                echo "$output"
                [ "$status" -eq 0 ]
                echo "${output}" | grep "Service removed."
        done
}

function teardown() {
    echo "$output"
}
