#!/usr/bin/env bats

## mongodb

MONGO_USERNAME='pmm_mongodb'
MONGO_PASSWORD="GRgrO9301RuF"

if [ -z ${pmm_server_ip+x} ]; then
   export pmm_server_ip=127.0.0.1
fi

@test "run pmm-admin under regular(non-root) user privileges" {
if [[ $(id -u) -eq 0 ]] ; then
        skip "Skipping this test, because you are running under root"
fi
run pmm-admin
echo "$output"
    [ "$status" -eq 1 ]
    [ "${lines[0]}" = "Usage: pmm-admin <command>" ]
}

@test "run pmm-admin under root privileges" {
if [[ $(id -u) -ne 0 ]] ; then
        skip "Skipping this test, because you are NOT running under root"
fi
run sudo pmm-admin
echo "$output"
    [ "$status" -eq 1 ]
    [ "${lines[0]}" = "Usage: pmm-admin <command>" ]
}


@test "run pmm-admin add mongodb based on running instances with metrics-mode push" {
    COUNTER=0
    IFS=$'\n'
  for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $3}') ; do
        let COUNTER=COUNTER+1
        MONGO_IP_PORT=${i}
        run pmm-admin add mongodb --username=$MONGO_USERNAME --password=$MONGO_PASSWORD --metrics-mode=push mongo_inst_${COUNTER} ${MONGO_IP_PORT}
      [ "$status" -eq 0 ]
      echo "${lines[0]}" | grep "MongoDB Service added"
  done
}

@test "run pmm-admin remove mongodb instance added with metrics mode push" {
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

@test "run pmm-admin add mongodb based on running instances with metrics-mode pull" {
    COUNTER=0
    IFS=$'\n'
  for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $3}') ; do
        let COUNTER=COUNTER+1
        MONGO_IP_PORT=${i}
        run pmm-admin add mongodb --username=$MONGO_USERNAME --password=$MONGO_PASSWORD --metrics-mode=pull mongo_inst_${COUNTER} ${MONGO_IP_PORT}
      [ "$status" -eq 0 ]
      echo "${lines[0]}" | grep "MongoDB Service added"
  done
}

@test "run pmm-admin remove mongodb instance added with metrics mode pull" {
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


@test "run pmm-admin add mongodb based on running instances" {
	COUNTER=0
	IFS=$'\n'
  for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $3}') ; do
		let COUNTER=COUNTER+1
		MONGO_IP_PORT=${i}
		run pmm-admin add mongodb --username=$MONGO_USERNAME --password=$MONGO_PASSWORD mongo_inst_${COUNTER} ${MONGO_IP_PORT}
	  [ "$status" -eq 0 ]
	  echo "${lines[0]}" | grep "MongoDB Service added"
  done
}

@test "run pmm-admin add mongodb again based on running instances to check if fails with error message exists" {
	COUNTER=0
	IFS=$'\n'
	for i in $(pmm-admin list | grep "MongoDB" | grep "mongo_inst_" | awk -F" " '{print $3}') ; do
		let COUNTER=COUNTER+1
		MONGO_IP_PORT=${i}
		run pmm-admin add mongodb --username=$MONGO_USERNAME --password=$MONGO_PASSWORD mongo_inst_${COUNTER} ${MONGO_IP_PORT}
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
		run pmm-admin add mongodb --username=$MONGO_USERNAME --password=$MONGO_PASSWORD --socket=/tmp/mongodb-${MONGO_PORT}.sock mongo_inst_${COUNTER} ${MONGO_IP_PORT}
        echo "$output"
        [ "$status" -eq 1 ]
        echo "${lines[0]}" | grep "Socket and address cannot be specified together."
    done
}

@test "run pmm-admin remove mongodb instance added based on running instances" {
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

@test "PMM-T157 PMM-T161 Adding MongoDB with specified socket for modb" {
skip "Skipping this test, because of random Failure"
    if [[ "$instance_t" == "mo" ]] ; then
        skip "Skipping this test, because you are running for Percona Distribution Mongodb"
    fi
    COUNTER=0
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $3}') ; do
        echo "$i"
        let COUNTER=COUNTER+1
        MONGO_IP_PORT=${i}
        export MONGO_IP=$(cut -d':' -f1 <<< $MONGO_IP_PORT)
        export MONGO_PORT=$(cut -d':' -f2 <<< $MONGO_IP_PORT)
        run pmm-admin add mongodb --username=$MONGO_USERNAME --password=$MONGO_PASSWORD --socket=/tmp/modb_${MONGO_PORT}/mongodb-27017.sock mongo_inst_${COUNTER}
        echo "$output"
        [ "$status" -eq 0 ]
        echo "${lines[0]}" | grep "MongoDB Service added"
    done
}


@test "run pmm-admin remove mongodb Instance added with Socket Specified" {
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
    [[ ${lines[0]} =~ "Usage: pmm-admin add mongodb [<name> [<address>]]" ]]
    echo "${output}" | grep -- "--socket=STRING"
}


@test "run pmm-admin add mongodb --help to check metrics-mode=\"auto\"" {
    run pmm-admin add mongodb --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "metrics-mode=\"auto\""
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

@test "run pmm-admin add mongodb based on running instances using servicename, port, username and password labels" {
	COUNTER=0
	IFS=$'\n'
  for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $3}') ; do
		let COUNTER=COUNTER+1
		MONGO_IP_PORT=${i}
		export MONGO_IP=$(cut -d':' -f1 <<< $MONGO_IP_PORT)
        export MONGO_PORT=$(cut -d':' -f2 <<< $MONGO_IP_PORT)
		run pmm-admin add mongodb --host=${MONGO_IP} --port=${MONGO_PORT} --username=$MONGO_USERNAME --password=$MONGO_PASSWORD --service-name=mongo_inst_${COUNTER}
	  [ "$status" -eq 0 ]
	  echo "${lines[0]}" | grep "MongoDB Service added"
  done
}

@test "run pmm-admin remove mongodb for instances added with servicename and username password labels" {
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

@test "PMM-T964 run pmm-admin add mongodb with --agent-password flag" {
    COUNTER=0
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $3}') ; do
        let COUNTER=COUNTER+1
        MONGO_IP_PORT=${i}
        export MONGO_IP=$(cut -d':' -f1 <<< $MONGO_IP_PORT)
        export MONGO_PORT=$(cut -d':' -f2 <<< $MONGO_IP_PORT)
        run pmm-admin add mongodb --host=${MONGO_IP} --username=$MONGO_USERNAME --password=$MONGO_PASSWORD --agent-password=mypass --port=${MONGO_PORT} --service-name=mongo_inst_${COUNTER}
        [ "$status" -eq 0 ]
        echo "${lines[0]}" | grep "MongoDB Service added"
    done
}

@test "PMM-T964 check metrics from mongodb service with custom agent password" {
skip "Skipping this test, because of Random Failures, need to fix this"
    COUNTER=0
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MongoDB" | grep "mongo_inst_" | awk -F" " '{print $3}') ; do
        let COUNTER=COUNTER+1
        run sleep 20
        run sudo chmod +x ./pmm-tests/pmm-2-0-bats-tests/check_metric.sh
        run ./pmm-tests/pmm-2-0-bats-tests/check_metric.sh mongo_inst_$COUNTER mongodb_up ${pmm_server_ip} mongodb_exporter pmm mypass
        echo "$output"
        [ "$status" -eq 0 ]
        [ "${lines[0]}" = "mongodb_up 1" ]
    done
}

@test "run pmm-admin remove mongodb added with custom agent password" {
    COUNTER=0
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MongoDB" | grep "mongo_inst_" | awk -F" " '{print $3}') ; do
        let COUNTER=COUNTER+1
        run pmm-admin remove mongodb mongo_inst_${COUNTER}
        [ "$status" -eq 0 ]
        echo "${lines[0]}"
        echo "${lines[0]}" | grep "Service removed."
    done
}

@test "PMM-T925 - Verify help for pmm-admin add mongodb has TLS-related flags" {
    run pmm-admin add mongodb --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "tls                        Use TLS to connect to the database"
    echo "${output}" | grep "tls-skip-verify            Skip TLS certificates validation"
    echo "${output}" | grep "tls-certificate-key-file=STRING"
    echo "${output}" | grep "tls-certificate-key-file-password=STRING"
    echo "${output}" | grep "tls-ca-file=STRING         Path to certificate authority file"
    echo "${output}" | grep "authentication-mechanism=STRING"
    echo "${output}" | grep "authentication-database=STRING"
}

function teardown() {
    echo "$output"
}
