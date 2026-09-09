#!/usr/bin/env bash
# reset-runner-clients.sh
#
# The PMM Server outlives the retry, so nodes a failed attempt already
# registered stay in its inventory with no agent behind them: unregister
# before wiping.
#
# Environment:
#   UNREGISTER_TIMEOUT_SECONDS  per-container bound, default 60

set -uo pipefail

timeout_seconds=${UNREGISTER_TIMEOUT_SECONDS:-60}

for container in $(docker ps -a --format '{{.Names}}'); do
    # The PMM Server's own container carries pmm-admin too, and unregistering
    # it would delete the server's self-monitoring node.
    case "$container" in
        pmm-server | watchtower) continue ;;
    esac

    if [ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null)" != true ]; then
        echo "${container} is not running, so its node cannot be unregistered from inside it and may remain in the inventory"
        continue
    fi

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
