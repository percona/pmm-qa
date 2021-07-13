
#!/usr/bin/env bats

## Verify mysql with tls 

@test "PMM-T789 - Verify help for pmm-admin add mysql has TLS-related flags" {
    run pmm-admin add mysql --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "tls                      Use TLS to connect to the$
    echo "${output}" | grep "tls-skip-verify          Skip TLS certificates val$
    echo "${output}" | grep "tls-ca=TLS-CA            Path to certificate autho$
    echo "${output}" | grep "tls-cert=TLS-CERT        Path to client certificat$
    echo "${output}" | grep "tls-key=TLS-KEY          Path to client key file"
}
