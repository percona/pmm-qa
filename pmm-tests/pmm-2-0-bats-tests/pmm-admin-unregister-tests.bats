if [ "${CLIENT_VERSION}" == "dev-latest" ]; then
   export PMM_VERSION=$(curl -s https://raw.githubusercontent.com/Percona-Lab/pmm-submodules/PMM-2.0/VERSION | xargs)
fi

@test "run pmm-admin --version --json" {
    run pmm-admin --version --json
    [ "$status" -eq 0 ]
}

@test "run pmm-admin --version --json and grep PMMVersion" {
    if [ ! -z ${PMM_VERSION+x} ]; then
        run pmm-admin --version --json
        echo $output
        [ "$status" -eq 0 ]
        echo $output | grep ${PMM_VERSION}
    else
        skip "Skipping version check because client version is not dev-latest"
    fi
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
    [ "${lines[0]}" = "Usage: pmm-admin unregister" ]
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
    echo "${output}" | grep '"node Testing is not found"'    
}

@test "run pmm-admin unregister --force --node-name=pmm-server" {
    run pmm-admin unregister --force --node-name=pmm-server
    echo $output
    [ $status -eq 1 ]
    echo "${output}" | grep "PMM Server node can't be removed."
}

@test "run pmm-admin unregister with --force" {
    run pmm-admin unregister --force
    echo $output
    [ $status -eq 0 ]
    echo "${output}" | grep "Node with ID"
    echo "${output}" | grep "unregistered."
}
