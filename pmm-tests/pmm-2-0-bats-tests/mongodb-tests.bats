#!/usr/bin/env bats

## mongodb

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


@test "run pmm-admin add mongodb based on running instances" {
	COUNTER=0
	IFS=$'\n'
  for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $3}') ; do
		let COUNTER=COUNTER+1
		MONGO_IP_PORT=${i}
		run pmm-admin add mongodb mongo_inst_${COUNTER} ${MONGO_IP_PORT}
	  [ "$status" -eq 0 ]
	  echo "${lines[0]}" | grep "MongoDB Service added"
  done
}

@test "run pmm-admin add mongodb again based on running instances" {
	COUNTER=0
	IFS=$'\n'
	for i in $(pmm-admin list | grep "MongoDB" | grep "mongo_inst_" | awk -F" " '{print $3}') ; do
		let COUNTER=COUNTER+1
		MONGO_IP_PORT=${i}
		run pmm-admin add mongodb mongo_inst_${COUNTER} ${MONGO_IP_PORT}
		[ "$status" -eq 1 ]
		echo "${lines[0]}" | grep "already exists."
	done
}

@test "PMM-T160 User can't use both socket and address while using pmm-admin add mongodb" {
    COUNTER=0
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $3}') ; do
        echo "$i"
        let COUNTER=COUNTER+1
		MONGO_IP_PORT=${i}
		export MONGO_PORT=$(cut -d':' -f2 <<< $MONGO_IP_PORT)
		run pmm-admin add mongodb --socket=/tmp/mongodb-${MONGO_PORT}.sock mongo_inst_${COUNTER} ${MONGO_IP_PORT}
        echo "$output"
        [ "$status" -eq 1 ]
        echo "${lines[0]}" | grep "Socket and address cannot be specified together."
    done
}

@test "run pmm-admin remove mongodb" {
	COUNTER=0
	IFS=$'\n'
	for i in $(pmm-admin list | grep "MongoDB" | grep "mongo_inst_" | awk -F" " '{print $3}') ; do
		let COUNTER=COUNTER+1
		MONGO_IP_PORT=${i}
		run pmm-admin remove mongodb mongo_inst_${COUNTER}
	  [ "$status" -eq 0 ]
	  echo "${lines[0]}"
	  echo "${lines[0]}" | grep "Service removed."
	done
}

@test "run pmm-admin remove mongodb again" {
    COUNTER=0
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $3}') ; do
        let COUNTER=COUNTER+1
        run pmm-admin remove mongodb mongo_inst_$COUNTER
        echo "$output"
        [ "$status" -eq 1 ]
        echo "${output}" | grep "not found."
    done
}

@test "PMM-T157 PMM-T161 Adding MongoDB with specified socket" {
    COUNTER=0
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $3}') ; do
        echo "$i"
        let COUNTER=COUNTER+1
        MONGO_IP_PORT=${i}
        export MONGO_IP=$(cut -d':' -f1 <<< $MONGO_IP_PORT)
        export MONGO_PORT=$(cut -d':' -f2 <<< $MONGO_IP_PORT)
        run pmm-admin add mongodb --socket=/tmp/mongodb-${MONGO_PORT}.sock mongo_inst_${COUNTER}
        echo "$output"
        [ "$status" -eq 0 ]
        echo "${lines[0]}" | grep "MongoDB Service added"
    done
}

@test "run pmm-admin remove mongodb" {
	COUNTER=0
	IFS=$'\n'
	for i in $(pmm-admin list | grep "MongoDB" | grep "mongo_inst_" | awk -F" " '{print $3}') ; do
		let COUNTER=COUNTER+1
		MONGO_IP_PORT=${i}
		run pmm-admin remove mongodb mongo_inst_${COUNTER}
	  [ "$status" -eq 0 ]
	  echo "${lines[0]}"
	  echo "${lines[0]}" | grep "Service removed."
	done
}

@test "run pmm-admin mongodb --help check for socket" {
    run pmm-admin add mongodb --help
    echo "$output"
    [ "$status" -eq 0 ]
    [[ ${lines[0]} =~ "usage: pmm-admin add mongodb [<flags>] [<name>] [<address>]" ]]
    [[ ${lines[35]} =~ "--socket=SOCKET" ]
}


@test "run pmm-admin add mongodb --help to check host" {
    run pmm-admin add mongodb --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "host"
}

@test "run pmm-admin add mongodb --help to check port" {
    run pmm-admin add mongodb --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "port"
}

@test "run pmm-admin add mongodb --help to check service-name" {
    run pmm-admin add mongodb --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "service-name"
}

@test "run pmm-admin add mongodb based on running instances" {
	COUNTER=0
	IFS=$'\n'
  for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $3}') ; do
		let COUNTER=COUNTER+1
		MONGO_IP_PORT=${i}
		export MONGO_IP=$(cut -d':' -f1 <<< $MONGO_IP_PORT)
        export MONGO_PORT=$(cut -d':' -f2 <<< $MONGO_IP_PORT)
		run pmm-admin add mongodb --host=${MONGO_IP} --port=${MONGO_PORT} --service-name=mongo_inst_${COUNTER}
	  [ "$status" -eq 0 ]
	  echo "${lines[0]}" | grep "MongoDB Service added"
  done
}

@test "run pmm-admin remove mongodb" {
	COUNTER=0
	IFS=$'\n'
	for i in $(pmm-admin list | grep "MongoDB" | grep "mongo_inst_" | awk -F" " '{print $3}') ; do
		let COUNTER=COUNTER+1
		MONGO_IP_PORT=${i}
		run pmm-admin remove mongodb mongo_inst_${COUNTER}
	  [ "$status" -eq 0 ]
	  echo "${lines[0]}"
	  echo "${lines[0]}" | grep "Service removed."
	done
}

function teardown() {
        echo "$output"
}
