@test "run pmm-admin --version --json" {
    run pmm-admin --version --json
    [ "$status" -eq 0 ]
}

@test "run pmm-admin --version --json and grep PMMVersion" {
    run pmm-admin --version --json
    echo $output
    [ "$status" -eq 0 ]
    echo $output | grep ${PMM_VERSION}
}

@test "run pmm-admin --version --json and validate json output with jq" {
    run pmm-admin --version --json
    echo $output
    [ $status -eq 0 ]
    echo $output | jq -e .
}

@test "run pmm-admin unregister --help" {
    run pmm-admin unregister --help
    echo $output
    [ $status -eq 0 ]
    [ "${lines[0]}" = "usage: pmm-admin unregister [<flags>]" ]
    [ "${lines[1]}" = "Unregister current Node from PMM Server" ]
}

@test "run pmm-admin unregister" {
    run pmm-admin unregister
    echo $output
    [ $status -eq 1 ]
    echo "${output}" | grep "Node with ID"
    echo "${output}" | grep "has agents."
}

@test "run pmm-admin unregister wrong node name and json" {
    run pmm-admin unregister --node-name=Testing --json --force
    echo $output
    [ $status -eq 1 ]
    echo "${output}" | grep '"Node Testing is not found"'    
}


@test "run pmm-admin unregister with --force" {
    run pmm-admin unregister --force
    echo $output
    [ $status -eq 0 ]
    echo "${output}" | grep "Node with ID"
    echo "${output}" | grep "unregistered."
}
