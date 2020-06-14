#!/usr/bin/env bats

if [ -z ${DOCKER_VERSION+x} ]; then
export DOCKER_VERSION=perconalab/pmm-server:dev-latest

fi

@test "PMM-T224 run docker container with a invalid value for a environment variable DATA_RETENTION=48" {
    if [[ $(id -u) -eq 0 ]] ; then
            skip "Skipping this test, because you are running under root"
    fi
    run docker run -d -p 81:80 -p 446:443 --name PMM-T224 -e DATA_RETENTION=48 ${DOCKER_VERSION}
    run sleep 60
    run bash -c 'docker ps | grep PMM-T224'
    echo "$output"
    [ "$status" -eq 1 ]
    run bash -c 'docker logs PMM-T224 2>&1 | grep "Configuration error: environment variable \"DATA_RETENTION=48\" has invalid duration 48"'
    echo "$output"
    [ "$status" -eq 0 ]
    run docker rm PMM-T224
    [ "$status" -eq 0 ]
}

@test "PMM-T225 run docker container with a unexpected environment variable DATA_TENTION=48" {
    if [[ $(id -u) -eq 0 ]] ; then
            skip "Skipping this test, because you are running under root"
    fi
    run docker run -d -p 82:80 -p 447:443 --name PMM-T225 -e DATA_TENTION=48 ${DOCKER_VERSION}
    run sleep 20
    run bash -c 'docker ps | grep PMM-T225'
    echo "$output"
    [ "$status" -eq 0 ]
    run bash -c 'docker logs PMM-T225 2>&1 | grep "Configuration warning: unknown environment variable \"DATA_TENTION=48\""'
    echo "$output"
    [ "$status" -eq 0 ]
    run docker stop PMM-T225
    run sleep 5
    run docker rm PMM-T225
    [ "$status" -eq 0 ]
}

@test "PMM-T226 run docker container with all valid environment variables not causing any warning or error message" {
    if [[ $(id -u) -eq 0 ]] ; then
            skip "Skipping this test, because you are running under root"
    fi
    run docker run -d -p 83:80 -p 447:443 --name PMM-T226 -e DATA_RETENTION=48h -e DISABLE_UPDATES=true -e DISABLE_TELEMETRY=false -e METRICS_RESOLUTION=24h -e METRICS_RESOLUTION_LR=24h -e METRICS_RESOLUTION_MR=24h ${DOCKER_VERSION}
    run sleep 20
    run bash -c 'docker ps | grep PMM-T226'
    echo "$output"
    [ "$status" -eq 0 ]
    run bash -c 'docker logs PMM-T226 2>&1 | grep "WARN"'
    echo "$output"
    [ "$status" -eq 1 ]
    run bash -c 'docker logs PMM-T226 2>&1 | grep "ERRO"'
    echo "$output"
    [ "$status" -eq 1 ]
    run docker stop PMM-T226
    run sleep 5
    run docker rm PMM-T226
    [ "$status" -eq 0 ]
}

function teardown() {
    echo "$output"
}

