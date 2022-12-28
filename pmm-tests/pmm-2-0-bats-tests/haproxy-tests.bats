#!/usr/bin/env bats

## haproxy

@test "PMM-T655 - Verify adding HAProxy as service" {
    run docker exec HAPROXY pmm-admin add haproxy --listen-port=42100 haproxyServiceCLI1
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "HAProxy Service added."
    run docker exec HAPROXY pmm-admin list
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "external-exporter        Unknown"
    echo "${output}" | grep "haproxyServiceCLI1"
}

@test "PMM-T657 - Verify skip-connection-check option while adding HAProxy service" {
    run docker exec HAPROXY pmm-admin add haproxy --listen-port=8455 --skip-connection-check haproxyServiceCLI2
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "HAProxy Service added."
}

@test "Remove HAProxy with connection check" {
    run docker exec HAPROXY pmm-admin remove haproxy haproxyServiceCLI2
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "Service removed."
}

@test "PMM-T674 - Verify help for adding HAProxy service help" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "help"
}

@test "PMM-T674 - Verify help for adding HAProxy service version" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "version"
}

@test "PMM-T674 - Verify help for adding HAProxy service server url" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "server-url=SERVER-URL"
}

@test "PMM-T674 - Verify help for adding HAProxy service server insecure tls" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "server-insecure-tls"
}

@test "PMM-T674 - Verify help for adding HAProxy service debug" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "debug"
}

@test "PMM-T674 - Verify help for adding HAProxy service trace" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "trace"
}

@test "PMM-T674 - Verify help for adding HAProxy service json" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "json"
}

@test "PMM-T674 - Verify help for adding HAProxy service username" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "username=STRING"
}

@test "PMM-T674 - Verify help for adding HAProxy service password" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "password=STRING"
}

@test "PMM-T674 - Verify help for adding HAProxy service scheme" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "scheme=http or https"
}

@test "PMM-T674 - Verify help for adding HAProxy service metrics path" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "metrics-path=/metrics"
}

@test "PMM-T674 - Verify help for adding HAProxy service listen port" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "listen-port=port"
}

@test "PMM-T674 - Verify help for adding HAProxy service node id" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "node-id=STRING "
}

@test "PMM-T674 - Verify help for adding HAProxy service environment" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "environment=prod"
}

@test "PMM-T674 - Verify help for adding HAProxy service cluster" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "cluster=east-cluster"
}

@test "PMM-T674 - Verify help for adding HAProxy service replication set" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "replication-set=rs1"
}

@test "PMM-T674 - Verify help for adding HAProxy service custom labels" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "custom-labels=KEY=VALUE,..."
}

@test "PMM-T674 - Verify help for adding HAProxy service metrics mode" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "metrics-mode=\"auto\""
}

@test "PMM-T674 - Verify help for adding HAProxy service skip connection check" {
    run docker exec HAPROXY pmm-admin add haproxy --help
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "skip-connection-check"
}

@test "PMM-T656 - Verify adding HAProxy service with wrong port" {
    run docker exec HAPROXY pmm-admin add haproxy --listen-port=8444
    echo "$output"
    [ "$status" -eq 1 ]
    echo "${output}" | grep 'Connection check failed: Get "http://127.0.0.1:8444/metrics": dial tcp 127.0.0.1:8444: connect: connection refused.'
}

@test "PMM-T705 - Remove HAProxy service" {
    run docker exec HAPROXY pmm-admin remove haproxy haproxyServiceCLI1
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "Service removed."
}
