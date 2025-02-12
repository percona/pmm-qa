
load "./lib/bats-support/load"  # Load BATS support libraries
load "./lib/bats-assert/load"   # Load BATS assertions

get_pmm_addr(){
    local node_port=8443
    local node_ip=127.0.0.1
    echo $node_ip:$node_port
}

get_pmm_version() {
    # depends on the driver, but probably local PVC wouldn't be cleaned up
    # and pass would be set only during this first pvc init
    # so always use new name if you want to provision PVC in helm install (pmmX)

    admin_pass=$(get_pmm_pswd)
    pmm_address=$(get_pmm_addr)

    # encode pass, as it can have special characters
    encoded_u_p=$(echo -n admin:${admin_pass} | base64)

    echo "curl -k -H 'Authorization: Basic ...' https://"${pmm_address}"/v1/version"
    # echo admin pass in case there are some issues with it
    echo "pass:${admin_pass}"

    run bash -c "curl -sk -H 'Authorization: Basic ${encoded_u_p}' https://${pmm_address}/v1/version | jq .version"
    assert_success

    # Check that the pmm_version string is not empty
    if [[ -z "${output}" ]]; then
        fail "pmm_version is empty"
    fi

    echo $output
}
