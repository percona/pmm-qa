#!/usr/bin/env bats

if [ -z ${DOCKER_VERSION+x} ]; then
export DOCKER_VERSION=public.ecr.aws/e7j3v3n0/pmm-server:dev-latest

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

@test "PMM-T526 Use Invalid Prometheus Custom Config File to Check if Container is unhealthy" {
    run docker run -d -p 84:80 -p 449:443 --name PMM-T526 ${DOCKER_VERSION}
    run sleep 30
    run docker cp /srv/pmm-qa/pmm-tests/broken_prometheus.base.yml PMM-T526:/srv/prometheus/prometheus.base.yml
    run docker restart PMM-T526
    run sleep 30
    run bash -c "echo $(docker ps --format '{{.Names}}\t{{.Status}}' | grep PMM-T526 | awk -F' ' '{print $5}' | awk -F'(' '{print $2}' | awk -F')' '{print $1}')"
    echo "$output"
    [ "$output" = "unhealthy" ]
    run docker stop PMM-T526
    run docker rm PMM-T526
    [ "$status" -eq 0 ]
}

@test "Basic Sanity using Clickhouse shipped with PMM-Server, Check Connection, Run a Query" {
    run bash -c 'clickhouse-client --database pmm --query "select any(example),sum(num_queries) cnt, max(m_query_time_max) slowest  from metrics where period_start>subtractHours(now(),6)  group by queryid order by slowest desc limit 10"'
    [ "$status" -eq 0 ]

    ## Check PMM Database Exist
    run bash -c "echo $(clickhouse-client --query 'SELECT * FROM system.databases' | grep pmm | awk -F' ' '{print $1}')"
    [ "$output" = "pmm" ]
    [ "$status" -eq 0 ]

    ## Check Data path matches expected Value
    run bash -c "echo $(clickhouse-client --query 'SELECT * FROM system.databases' | grep pmm | awk -F' ' '{print $3}')"
    [ "$output" = "/srv/clickhouse/data/pmm/" ]
    [ "$status" -eq 0 ]

    ## Check Metadata path matches expected Value
    run bash -c "echo $(clickhouse-client --query 'SELECT * FROM system.databases' | grep pmm | awk -F' ' '{print $4}')"
    [ "$output" = "/srv/clickhouse/metadata/pmm/" ]
    [ "$status" -eq 0 ]

}

function teardown() {
    echo "$output"
}

