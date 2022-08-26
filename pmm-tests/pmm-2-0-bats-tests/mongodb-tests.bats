#!/usr/bin/env bats

## mongodb

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
        run pmm-admin add mongodb --metrics-mode=push mongo_inst_${COUNTER} ${MONGO_IP_PORT}
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

@test "run pmm-admin add mongodb based on running instances with metrics-mode pull" {
    COUNTER=0
    IFS=$'\n'
  for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $3}') ; do
        let COUNTER=COUNTER+1
        MONGO_IP_PORT=${i}
        run pmm-admin add mongodb --metrics-mode=pull mongo_inst_${COUNTER} ${MONGO_IP_PORT}
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

@test "PMM-T157 PMM-T161 Adding MongoDB with specified socket for psmdb" {
skip "Skipping this test, because of setup issue on Framework, https://jira.percona.com/browse/PMM-8708"
    if [[ "$instance_t" == "modb" ]] ; then
        skip "Skipping this test, because you are running for official Mongodb"
    fi
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

@test "PMM-T157 PMM-T161 Adding MongoDB with specified socket for modb" {
skip "Skipping this test, because of setup issue on Framework, https://jira.percona.com/browse/PMM-8708"
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
        run pmm-admin add mongodb --socket=/tmp/modb_${MONGO_PORT}/mongodb-27017.sock mongo_inst_${COUNTER}
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

@test "PMM-T964 run pmm-admin add mongodb with --agent-password flag" {
    COUNTER=0
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MongoDB" | awk -F" " '{print $3}') ; do
        let COUNTER=COUNTER+1
        MONGO_IP_PORT=${i}
        export MONGO_IP=$(cut -d':' -f1 <<< $MONGO_IP_PORT)
        export MONGO_PORT=$(cut -d':' -f2 <<< $MONGO_IP_PORT)
        run pmm-admin add mongodb --host=${MONGO_IP} --agent-password=mypass --port=${MONGO_PORT} --service-name=mongo_inst_${COUNTER}
        [ "$status" -eq 0 ]
        echo "${lines[0]}" | grep "MongoDB Service added"
    done
}

@test "PMM-T964 check metrics from mongodb service with custom agent password" {
skip "Skipping this test, because of random failure and flaky behaviour"
    COUNTER=0
    IFS=$'\n'
    for i in $(pmm-admin list | grep "MongoDB" | grep "mongo_inst_" | awk -F" " '{print $3}') ; do
        let COUNTER=COUNTER+1
        run sleep 20
        run sudo chmod +x /srv/pmm-qa/pmm-tests/pmm-2-0-bats-tests/check_metric.sh
        run /srv/pmm-qa/pmm-tests/pmm-2-0-bats-tests/check_metric.sh mongo_inst_$COUNTER mongodb_up ${pmm_server_ip} mongodb_exporter pmm mypass
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
