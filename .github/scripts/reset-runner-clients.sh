#!/usr/bin/env bash
# reset-runner-clients.sh
#
# Cleanup between attempts of the "Run setup for E2E tests" step, for the
# workflows that point pmm-framework at a PMM Server this runner does not own.
#
# Wiping the runner's Docker state is not enough on its own. The PMM Server
# outlives the retry, so nodes a failed attempt already registered stay in its
# inventory with no agent behind them, and the next attempt registers fresh
# ones under new random names (start-sharded.sh suffixes every node with
# $RANDOM). The leftovers then show up as services in "Failed" state and
# inflate the inventory counts the dashboard panels are compared against.
#
# So unregister every container-hosted node first, then wipe.
#
# Usage:
#   reset-runner-clients.sh
#
# Environment:
#   UNREGISTER_TIMEOUT_SECONDS  per-container bound, default 60

set -uo pipefail

timeout_seconds=${UNREGISTER_TIMEOUT_SECONDS:-60}

for container in $(docker ps --format '{{.Names}}'); do
    # The PMM Server's own container carries pmm-admin too, and unregistering
    # it would delete the server's self-monitoring node.
    case "$container" in
        pmm-server | watchtower) continue ;;
    esac

    if ! docker exec "$container" sh -c 'command -v pmm-admin' >/dev/null 2>&1; then
        continue
    fi

    timeout "$timeout_seconds" docker exec "$container" pmm-admin unregister --force >/dev/null 2>&1
    case $? in
        0) echo "unregistered the node hosted by ${container}" ;;
        124) echo "timed out after ${timeout_seconds}s unregistering the node hosted by ${container}" ;;
        *) echo "could not unregister the node hosted by ${container} — it may be left in the inventory" ;;
    esac
done

docker ps -a -q | xargs -r docker rm -f || true
docker volume ls -q | xargs -r docker volume rm -f || true
docker network ls -q | xargs -r docker network rm -f || true
