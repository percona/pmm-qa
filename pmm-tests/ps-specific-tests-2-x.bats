#!/usr/bin/env bats

## mysql


MYSQL_USER='root'

@test "run pmm-admin under regular(non-root) user privileges" {
if [[ $(id -u) -eq 0 ]] ; then
	skip "Skipping this test, because you are running under root"
fi
run pmm-admin
echo "$output"
    [ "$status" -eq 1 ]
    [ "${lines[0]}" = "usage: pmm-admin [<flags>] <command> [<args> ...]" ]
}


@test "run pmm-admin under root privileges" {
if [[ $(id -u) -ne 0 ]] ; then
	skip "Skipping this test, because you are NOT running under root"
fi
run pmm-admin
echo "$output"
    [ "$status" -eq 1 ]
    [ "${lines[0]}" = "usage: pmm-admin [<flags>] <command> [<args> ...]" ]
}


@test "run pmm-admin add mysql based on running intsances" {
	  COUNTER=0
		for i in $(pmm-admin list | grep "MySQL" | sed 's|.*(||;s|)||') ; do
      let COUNTER=COUNTER+1
			run pmm-admin add mysql --username=${MYSQL_USER} localhost:3306 mysql_$COUNTER
			echo "$output"
	    	[ "$status" -eq 0 ]
	    	echo "${lines[0]}" | grep "MySQL Service added."
		done
}


@test "run pmm-admin add mysql again based on running instances" {
	COUNTER=0
	for i in $(pmm-admin list | grep "MySQL" | grep "mysql_" | sed 's|.*(||;s|)||') ; do
		let COUNTER=COUNTER+1
		run pmm-admin add mysql:metrics --username=${MYSQL_USER} mysql__$COUNTER
		echo "$output"
			[ "$status" -eq 1 ]
			[ "${lines[0]}" = "Service with name mysql_${COUNTER} already exists." ]
	done
}

@test "run pmm-admin remove mysql" {
	COUNTER=0
	for i in $(pmm-admin list | grep "MySQL" | grep "mysql_") ; do
		let COUNTER=COUNTER+1
		run pmm-admin remove mysql mysql_$COUNTER
		echo "$output"
			[ "$status" -eq 0 ]
			echo "${output}" | grep "OK, removed"
	done
}


@test "run pmm-admin remove mysql again" {
	COUNTER=0
	for i in $(sudo pmm-admin list | grep "mysql_metrics_" | grep -Eo '\/.*\)' | sed 's/)$//') ; do
		let COUNTER=COUNTER+1
		MYSQL_SOCK=${i}
		run sudo pmm-admin remove mysql:metrics mysql_metrics_$COUNTER
		echo "$output"
			[ "$status" -eq 0 ]
			echo "${output}" | grep "no service found"
	done
}