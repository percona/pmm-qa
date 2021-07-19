#!/usr/bin/env bats

## Verify mysql with tls 

@test "PMM-T789 - Verify help for pmm-admin add mysql has TLS-related flags" {
    run pmm-admin add mysql --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "tls                      Use TLS to connect to the database"
    echo "${output}" | grep "tls-skip-verify          Skip TLS certificates validation"
    echo "${output}" | grep "tls-ca=TLS-CA            Path to certificate authority certificate file"
    echo "${output}" | grep "tls-cert=TLS-CERT        Path to client certificate file"
    echo "${output}" | grep "tls-key=TLS-KEY          Path to client key file"
}

@test "PMM-T791 - Verify adding MySQL with --tls flag and certificates" {
    run pmm-admin add mysql --username=root --password=r00tr00t --port=3308 --query-source=perfschema --tls --tls-skip-verify --tls-ca=/tmp/ssl/pmm-ui-tests/testdata/mysql/ssl-cert-scripts/certs/root-ca.pem --tls-cert=/tmp/ssl/pmm-ui-tests/testdata/mysql/ssl-cert-scripts/certs/client-cert.pem --tls-key=/tmp/ssl/pmm-ui-tests/testdata/mysql/ssl-cert-scripts/certs/client-key.pem bats_tls_mysql
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${lines[0]}" | grep "MySQL Service added."
    echo "${lines[2]}" | grep "Service name: bats_tls_mysql"
}
