#!/usr/bin/env bats

## mysql


MYSQL_USER='msandbox'
MYSQL_PASSWORD="msandbox"

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

@test "run pmm-admin add mysql based on running intsances" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" | awk -F" " '{print $3}') ; do
                echo "$i"
                let COUNTER=COUNTER+1
                MYSQL_IP_PORT=${i}
                run pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} mysql_$COUNTER ${MYSQL_IP_PORT}
                echo "$output"
                [ "$status" -eq 0 ]
                echo "${lines[0]}" | grep "MySQL Service added."
        done
}


@test "run pmm-admin add mysql again based on running instances" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" | grep "mysql_" | awk -F" " '{print $3}') ; do
                let COUNTER=COUNTER+1
                MYSQL_IP_PORT=${i}
                run pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} mysql_$COUNTER ${MYSQL_IP_PORT}
                echo "$output"
                        [ "$status" -eq 1 ]
                        echo "${lines[0]}" | grep "already exists."
        done
}

@test "run pmm-admin remove mysql" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" | grep "mysql_") ; do
                let COUNTER=COUNTER+1
                run pmm-admin remove mysql mysql_$COUNTER
                echo "$output"
                        [ "$status" -eq 0 ]
                        echo "${output}" | grep "Service removed."
        done
}

@test "run pmm-admin add mysql --help" {
    run pmm-admin add mysql --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "disable-tablestats"
}

@test "run pmm-admin add mysql --help" {
    run pmm-admin add mysql --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "disable-tablestats-limit=DISABLE-TABLESTATS-LIMIT"
}

@test "run pmm-admin add mysql with both disable-tablestats and disable-tablestats-limit" {
    COUNTER=0
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MySQL" | awk -F" " '{print $3}') ; do
            echo "$i"
            let COUNTER=COUNTER+1
            MYSQL_IP_PORT=${i}
            run pmm-admin add mysql --query-source=perfschema --disable-tablestats --disable-tablestats-limit=50 --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} mysql_$COUNTER ${MYSQL_IP_PORT}
            echo "$output"
            [ "$status" -eq 1 ]
            echo "${lines[0]}" | grep "both --disable-tablestats and --disable-tablestats-limit are passed"
    done
}

@test "run pmm-admin add mysql with disable-tablestats" {
    COUNTER=0
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MySQL" | awk -F" " '{print $3}') ; do
            echo "$i"
            let COUNTER=COUNTER+1
            MYSQL_IP_PORT=${i}
            run pmm-admin add mysql --query-source=perfschema --disable-tablestats --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} mysql_$COUNTER ${MYSQL_IP_PORT}
            echo "$output"
            [ "$status" -eq 0 ]
            echo "${output}" | grep "Table statistics collection disabled (always)."
    done
}

@test "run pmm-admin remove mysql" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" | grep "mysql_") ; do
                let COUNTER=COUNTER+1
                run pmm-admin remove mysql mysql_$COUNTER
                echo "$output"
                        [ "$status" -eq 0 ]
                        echo "${output}" | grep "Service removed."
        done
}

@test "run pmm-admin add mysql with disable-tablestats-limit=50" {
    COUNTER=0
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MySQL" | awk -F" " '{print $3}') ; do
            echo "$i"
            let COUNTER=COUNTER+1
            MYSQL_IP_PORT=${i}
            run pmm-admin add mysql --query-source=perfschema --disable-tablestats-limit=50 --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} mysql_$COUNTER ${MYSQL_IP_PORT}
            echo "$output"
            [ "$status" -eq 0 ]
            echo "${output}" | grep "Table statistics collection disabled"
    done
}

@test "run pmm-admin remove mysql" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" | grep "mysql_") ; do
                let COUNTER=COUNTER+1
                run pmm-admin remove mysql mysql_$COUNTER
                echo "$output"
                        [ "$status" -eq 0 ]
                        echo "${output}" | grep "Service removed."
        done
}

@test "run pmm-admin remove mysql again" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" ) ; do
                let COUNTER=COUNTER+1
                run pmm-admin remove mysql mysql_$COUNTER
                echo "$output"
                        [ "$status" -eq 1 ]
                        echo "${output}" | grep "not found."
        done
}
