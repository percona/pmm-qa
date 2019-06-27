#!/usr/bin/env bats

## postgresql


PGSQL_USER='postgres'
PGSQL_HOST='localhost'

@test "run pmm-admin under regular(non-root) user privileges" {
if [[ $(id -u) -eq 0 ]] ; then
        skip "Skipping this test, because you are running under root"
fi
run pmm-admin
echo "$output"
    [ "$status" -eq 0 ]
    [ "${lines[0]}" = "usage: pmm-admin [<flags>] <command> [<args> ...]" ]
}

@test "run pmm-admin under root privileges" {
if [[ $(id -u) -ne 0 ]] ; then
        skip "Skipping this test, because you are NOT running under root"
fi
run sudo pmm-admin
echo "$output"
    [ "$status" -eq 0 ]
    [ "${lines[0]}" = "usage: pmm-admin [<flags>] <command> [<args> ...]" ]
}

@test "run pmm-admin add postgresql based on running intsances" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "PostgreSQL" | awk -F" " '{print $3}') ; do
                let COUNTER=COUNTER+1
                PGSQL_IP_PORT=${i}
                run pmm-admin add postgresql ${PGSQL_IP_PORT} pgsql_$COUNTER
                echo "$output"
                [ "$status" -eq 0 ]
                echo "${lines[0]}" | grep "PostgreSQL Service added."
        done
}

@test "run pmm-admin add postgresql again based on running instances" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "PostgreSQL" | grep "pgsql_" | awk -F" " '{print $3}') ; do
                let COUNTER=COUNTER+1
                PGSQL_IP_PORT=${i}
                run pmm-admin add postgresql ${PGSQL_IP_PORT} pgsql_$COUNTER
                echo "$output"
                        [ "$status" -eq 1 ]
                        echo "${output}" | grep "already exists."
        done
}


@test "run pmm-admin remove postgresql" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "PostgreSQL" | grep "pgsql_") ; do
                let COUNTER=COUNTER+1
                run pmm-admin remove postgresql pgsql_$COUNTER
                echo "$output"
                        [ "$status" -eq 0 ]
                        echo "${output}" | grep "Service removed."
        done
}


@test "run pmm-admin remove postgresql again" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "PostgreSQL") ; do
                let COUNTER=COUNTER+1
                run pmm-admin remove postgresql pgsql_$COUNTER
                echo "$output"
                        [ "$status" -eq 1 ]
                        echo "${output}" | grep "not found."
        done
}

function teardown() {
        echo "$output"
}
