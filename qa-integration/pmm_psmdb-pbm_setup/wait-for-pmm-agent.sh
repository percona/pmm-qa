#!/bin/bash
# `pmm-agent setup` returns as soon as the agent's own local API answers again after the
# config reload -- it does not wait for the agent to re-establish its connection to PMM
# Server. `pmm-admin add` needs that connection and aborts with "pmm-agent is not connected
# to PMM Server" when it is not up yet, so callers must wait in between.
wait_for_pmm_agent() {
    local compose_file=$1 node=$2

    if ! docker compose -f "$compose_file" exec -T "$node" pmm-admin status --wait=120s | grep -qE 'Connected[[:space:]]+: true'; then
        echo "ERROR: pmm-agent on ${node} did not connect to PMM Server within 120s" >&2
        return 1
    fi
}
