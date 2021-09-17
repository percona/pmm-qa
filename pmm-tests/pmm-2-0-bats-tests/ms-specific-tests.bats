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

@test "run pmm-admin status --json check for RUNNING string in output" {
    run bash -c 'pmm-admin status --json | grep "RUNNING"'
    echo "${output}"
    [ "$status" -eq 0 ]
}

@test "run pmm-admin status check for RUNNING string in output for VM_AGENT" {
    run bash -c 'pmm-admin status | grep "vmagent Running"'
    echo "${output}"
    [ "$status" -eq 0 ]
}

@test "run pmm-admin status check for Running string in output" {
    run bash -c 'pmm-admin status | grep "Running"'
    echo "${output}"
    [ "$status" -eq 0 ]
}

@test "run pmm-admin status check for RUNNING string in output" {
    run bash -c 'pmm-admin status | grep "RUNNING"'
    echo "$output"
    [ "$status" -eq 1 ]
}

@test "run pmm-admin status --json check for Running string in output" {
    run bash -c 'pmm-admin status --json | grep "Running"'
    echo "$output"
    [ "$status" -eq 1 ]
}

@test "run pmm-admin list check for msqld_exporter string in output" {
    run bash -c 'pmm-admin list | grep "msqld_exporter"'
    echo "$output"
    [ "$status" -eq 1 ]
}

@test "run pmm-admin list check for MYSQLD_EXPORTER string in output" {
    run bash -c 'pmm-admin status | grep "MYSQLD_EXPORTER"'
    echo "$output"
    [ "$status" -eq 1 ]
}

@test "run pmm-admin list --json check for msqld_exporter string in output" {
    run bash -c 'pmm-admin list --json | grep "msqld_exporter"'
    echo "$output"
    [ "$status" -eq 1 ]
}

@test "run pmm-admin list --json check for MYSQLD_EXPORTER string in output" {
    run bash -c 'pmm-admin status --json | grep "MYSQLD_EXPORTER"'
    echo "$output"
    [ "$status" -eq 0 ]
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

@test "run pmm-admin add mysql --help to check disable-tablestats" {
    run pmm-admin add mysql --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "disable-tablestats"
}

@test "run pmm-admin add mysql --help to check metrics-mode=auto" {
    run pmm-admin add mysql --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "metrics-mode=auto"
}

@test "run pmm-admin add mysql --help to check host" {
    run pmm-admin add mysql --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "host"
}

@test "run pmm-admin add mysql --help to check port" {
    run pmm-admin add mysql --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "port"
}

@test "run pmm-admin add mysql --help to check service-name" {
    run pmm-admin add mysql --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "service-name"
}

@test "run pmm-admin add mysql based on running intsances using host, port and service name" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" | awk -F" " '{print $3}') ; do
                echo "$i"
                let COUNTER=COUNTER+1
                MYSQL_IP_PORT=${i}
                export MYSQL_IP=$(cut -d':' -f1 <<< $MYSQL_IP_PORT)
                export MYSQL_PORT=$(cut -d':' -f2 <<< $MYSQL_IP_PORT)
                run pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} --host=${MYSQL_IP} --port=${MYSQL_PORT} --service-name=mysql_$COUNTER
                echo "$output"
                [ "$status" -eq 0 ]
                echo "${lines[0]}" | grep "MySQL Service added."
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

@test "run pmm-admin add mysql using metrics-mode as push" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" | awk -F" " '{print $3}') ; do
                echo "$i"
                let COUNTER=COUNTER+1
                MYSQL_IP_PORT=${i}
                export MYSQL_IP=$(cut -d':' -f1 <<< $MYSQL_IP_PORT)
                export MYSQL_PORT=$(cut -d':' -f2 <<< $MYSQL_IP_PORT)
                run pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} --host=${MYSQL_IP} --port=${MYSQL_PORT} --service-name=mysql_$COUNTER --metrics-mode=push
                echo "$output"
                [ "$status" -eq 0 ]
                echo "${lines[0]}" | grep "MySQL Service added."
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

@test "run pmm-admin add mysql using metrics-mode as pull" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" | awk -F" " '{print $3}') ; do
                echo "$i"
                let COUNTER=COUNTER+1
                MYSQL_IP_PORT=${i}
                export MYSQL_IP=$(cut -d':' -f1 <<< $MYSQL_IP_PORT)
                export MYSQL_PORT=$(cut -d':' -f2 <<< $MYSQL_IP_PORT)
                run pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} --host=${MYSQL_IP} --port=${MYSQL_PORT} --service-name=mysql_$COUNTER --metrics-mode=pull
                echo "$output"
                [ "$status" -eq 0 ]
                echo "${lines[0]}" | grep "MySQL Service added."
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

@test "PMM-T160 User can't use both socket and address while using pmm-admin add mysql" {
    COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" | awk -F" " '{print $3}') ; do
                echo "$i"
                let COUNTER=COUNTER+1
                MYSQL_IP_PORT=${i}
                export MYSQL_IP=$(cut -d':' -f1 <<< $MYSQL_IP_PORT)
                export MYSQL_PORT=$(cut -d':' -f2 <<< $MYSQL_IP_PORT)
                run pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} --host=${MYSQL_IP} --socket=/tmp/mysql_sandbox${MYSQL_PORT}.sock --service-name=mysql_$COUNTER
                echo "$output"
                [ "$status" -eq 1 ]
                echo "${lines[0]}" | grep "Socket and address cannot be specified together."
        done
}

@test "PMM-T159 User can't use both socket and port while using pmm-admin add mysql" {
    COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" | awk -F" " '{print $3}') ; do
                echo "$i"
                let COUNTER=COUNTER+1
                MYSQL_IP_PORT=${i}
                export MYSQL_IP=$(cut -d':' -f1 <<< $MYSQL_IP_PORT)
                export MYSQL_PORT=$(cut -d':' -f2 <<< $MYSQL_IP_PORT)
                run pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} --port=${MYSQL_PORT} --socket=/tmp/mysql_sandbox${MYSQL_PORT}.sock --service-name=mysql_$COUNTER
                echo "$output"
                [ "$status" -eq 1 ]
                echo "${lines[0]}" | grep "Socket and port cannot be specified together."
        done
}

@test "PMM-T157 PMM-T161 Adding MySQL with specified socket" {
    COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" | awk -F" " '{print $3}') ; do
                echo "$i"
                let COUNTER=COUNTER+1
                MYSQL_IP_PORT=${i}
                export MYSQL_IP=$(cut -d':' -f1 <<< $MYSQL_IP_PORT)
                export MYSQL_PORT=$(cut -d':' -f2 <<< $MYSQL_IP_PORT)
                run pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER} --password=${MYSQL_PASSWORD} --socket=/tmp/mysql_sandbox${MYSQL_PORT}.sock --service-name=mysql_$COUNTER
                echo "$output"
                [ "$status" -eq 0 ]
                echo "${lines[0]}" | grep "MySQL Service added."
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

@test "run pmm-admin mysql --help check for socket" {
    run pmm-admin add mysql --help
    echo "$output"
        [ "$status" -eq 0 ]
        [[ ${lines[0]} =~ "usage: pmm-admin add mysql [<flags>] [<name>] [<address>]" ]]
        [[ ${lines[13]} =~ "--socket=SOCKET" ]]
}

@test "run pmm-admin add mysql --help to check disable-tablestats-limit" {
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

@test "PMM-T962 run pmm-admin add mysql with --agent-password flag" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" | awk -F" " '{print $3}') ; do
                let COUNTER=COUNTER+1
                MYSQL_IP_PORT=${i}
                run pmm-admin add mysql --query-source=perfschema --username=${MYSQL_USER} --agent-password=mypass --password=${MYSQL_PASSWORD} mysql_$COUNTER ${MYSQL_IP_PORT}
                echo "$output"
                [ "$status" -eq 0 ]
                echo "${lines[0]}" | grep "MySQL Service added."
        done
}

@test "PMM-T962 check metrics from service with custom agent password" {
        COUNTER=0
        IFS=$'\n'
        for i in $(pmm-admin list | grep "MySQL" | grep "mysql_") ; do
                let COUNTER=COUNTER+1
                run sleep 20
                run chmod +x /srv/pmm-qa/pmm-tests/pmm-2-0-bats-tests/check_metric.sh
                run /srv/pmm-qa/pmm-tests/pmm-2-0-bats-tests/check_metric.sh mysql_$COUNTER mysql_up ${pmm_server_ip} mysqld_exporter pmm mypass
                echo "$output"
                [ "$status" -eq 0 ]
                [ "${lines[0]}" = "mysql_up 1" ]
        done
}

@test "run pmm-admin remove mysql added with custom agent password" {
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

function teardown() {
        echo "$output"
}
