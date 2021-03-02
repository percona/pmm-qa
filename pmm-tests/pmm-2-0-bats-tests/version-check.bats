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

@test "run pmm-admin --version" {
 run pmm-admin --version
 echo "$output"
 	[ "$status" -eq 0 ]
	echo "$output" | grep "Version: 2.15.0"
}

@test "run pmm-admin summary --version" {
run pmm-admin summary --version
echo "$output"
    [ "$status" -eq 0 ]
    echo "$output" | grep "Version: 2.15.0"
}
