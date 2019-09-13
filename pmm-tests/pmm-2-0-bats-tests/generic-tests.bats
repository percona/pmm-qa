## Generic bats tests

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
run pmm-admin
echo "$output"
    [ "$status" -eq 0 ]
    [ "${lines[0]}" = "usage: pmm-admin [<flags>] <command> [<args> ...]" ]
}

@test "run pmm-admin without any arguments" {
run pmm-admin
echo "$output"
    [ "$status" -eq 0 ]
    [ "${lines[0]}" = "usage: pmm-admin [<flags>] <command> [<args> ...]" ]
}

@test "run pmm-admin help" {
run pmm-admin help
echo "$output"
    [ "$status" -eq 0 ]
    [ "${lines[0]}" = "usage: pmm-admin [<flags>] <command> [<args> ...]" ]
}

@test "run pmm-admin -h" {
run pmm-admin -h
echo "$output"
    [ "$status" -eq 0 ]
    [ "${lines[0]}" = "usage: pmm-admin [<flags>] <command> [<args> ...]" ]
}

@test "run pmm-admin with wrong option" {
run pmm-admin install
echo "$output"
    [ "$status" -eq 1 ]
    echo "${output}" | grep "pmm-admin: error: expected command but got"
}

@test "run pmm-admin list to check for available services" {
run pmm-admin list
echo "$output"
    [ "$status" -eq 0 ]
}

@test "run pmm-admin --version" {
 run pmm-admin --version
 echo "$output"
 	[ "$status" -eq 0 ]
 	echo "$output" | grep "Version: 2.0"
}

@test "run pmm-admin config without parameters" {
run pmm-admin config
echo "$output"
	[ "$status" -eq 1 ]
	[ "${lines[0]}" = "Using /usr/local/percona/pmm2/exporters/node_exporter" ]
}
