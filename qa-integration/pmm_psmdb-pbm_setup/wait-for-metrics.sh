#!/bin/bash
# The dbstats, collstats and indexstats collectors ride PMM's low-resolution scrape job
# (60s by default), so `pmm-admin add` returning does not mean their metrics exist yet --
# the first low-resolution scrape lands up to a full interval later, and the vmagent
# remote-write flush after it. Dashboard tests start within seconds of setup finishing,
# so wait for the first sample here instead of leaving every such test to race it.
#
# Bounded and non-fatal on purpose: if the metrics never arrive that is a real "PMM
# collects nothing here" signal, and the test that asserts on those panels must still be
# the thing that reports it.
wait_for_dbstats_metrics() {
    local compose_file=$1 node=$2 service=$3 timeout=${4:-180}
    local deadline=$((SECONDS + timeout))

    while [ "$SECONDS" -lt "$deadline" ]; do
        if docker compose -f "$compose_file" exec -T -e SVC="$service" "$node" bash -c \
            'curl -sk -u "$PMM_AGENT_SERVER_USERNAME:$PMM_AGENT_SERVER_PASSWORD" \
               --data-urlencode "query=count(mongodb_dbstats_dataSize{service_name=\"$SVC\"})" \
               "https://$PMM_AGENT_SERVER_ADDRESS/prometheus/api/v1/query"' \
            2>/dev/null | grep -q '"result":\[{'; then
            echo "mongodb_dbstats_* metrics present for ${service}"
            return 0
        fi
        sleep 5
    done

    echo "WARNING: no mongodb_dbstats_* metrics for ${service} after ${timeout}s" >&2
    return 0
}
