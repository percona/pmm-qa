#!/usr/bin/env bats

## Verify mysql with tls 

@test "PMM-T789 - Verify help for pmm-admin add mysql has TLS-related flags" {
    run pmm-admin add mysql --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "tls                       Use TLS to connect to the database"
    echo "${output}" | grep "tls-skip-verify           Skip TLS certificates validation"
    echo "${output}" | grep "tls-ca=STRING             Path to certificate authority certificate file"
    echo "${output}" | grep "tls-cert=STRING           Path to client certificate file"
    echo "${output}" | grep "tls-key=STRING            Path to client key file"
}

