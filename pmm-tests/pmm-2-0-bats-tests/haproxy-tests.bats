#!/usr/bin/env bats

## haproxy

@test "PMM-T655 - Verify adding HAProxy as service" {
    run pmm-admin add haproxy --listen-port=8404
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "HAProxy Service added."
    run pmm-admin list
    echo "$output"
    [ "$status" -eq 0 ]
    echo "${output}" | grep "external-exporter        Unknown"
}

