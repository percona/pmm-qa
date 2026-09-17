#!/bin/bash
# The mongo stacks start mongod via systemd inside each container, so `docker
# compose up -d` returning does not mean 27017 is listening yet. A blind `sleep`
# races that startup and, on a loaded or freshly re-provisioned host, connects
# before mongod is up -- the "connect ECONNREFUSED 127.0.0.1:27017" that fails
# rs.initiate. Poll the real state instead. `ping`/`hello` are allowed pre-auth
# (before rs.initiate and before any user exists), so no credentials are needed.

wait_for_mongod() {
    local compose_file=$1 node=$2 timeout=${3:-240} waited=0

    echo "waiting for mongod on ${node} to accept connections"
    until docker compose -f "$compose_file" exec -T "$node" mongo --quiet --eval 'db.adminCommand({ping:1}).ok' 2>/dev/null | grep -q '^1$'; do
        waited=$((waited+3))
        if [ "$waited" -ge "$timeout" ]; then
            echo "ERROR: mongod on ${node} did not accept connections within ${timeout}s" >&2
            docker compose -f "$compose_file" exec -T "$node" systemctl --no-pager --failed 2>&1 | head -20 >&2 || true
            return 1
        fi
        sleep 3
    done
    echo "mongod on ${node} is accepting connections"
}

wait_for_primary() {
    local compose_file=$1 node=$2 timeout=${3:-180} waited=0

    echo "waiting for ${node} to be elected PRIMARY"
    until docker compose -f "$compose_file" exec -T "$node" mongo --quiet --eval 'db.hello().isWritablePrimary' 2>/dev/null | grep -q true; do
        waited=$((waited+3))
        if [ "$waited" -ge "$timeout" ]; then
            echo "ERROR: ${node} did not become PRIMARY within ${timeout}s" >&2
            return 1
        fi
        sleep 3
    done
    echo "${node} is PRIMARY"
}
