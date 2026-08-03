#!/usr/bin/env bash
# Local smoke test for PSMDB entrypoint + systemctl shim (run against rs101).
set -euo pipefail
node=${1:-rs101}

fail() { echo "FAIL: $*"; exit 1; }
pass() { echo "OK: $*"; }

echo "=== testing $node ==="

docker exec "$node" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null \
  || fail "mongod not up before test"

docker exec "$node" systemctl stop mongod
for _ in $(seq 1 30); do
  docker exec "$node" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1 && sleep 1 && continue
  break
done
docker exec "$node" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1 \
  && fail "mongod still responds after systemctl stop"
sleep 3
docker exec "$node" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1 \
  && fail "mongod auto-restarted after systemctl stop"
pass "systemctl stop mongod (stays stopped)"

docker exec "$node" systemctl start mongod
for _ in $(seq 1 60); do
  docker exec "$node" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$node" mongosh --quiet --eval 'db.adminCommand({ping:1})' >/dev/null \
  || fail "mongod did not come back after systemctl start"
pass "systemctl start mongod"

docker exec "$node" systemctl restart pbm-agent
pgrep_out=$(docker exec "$node" pgrep -u mongod -x pbm-agent || true)
[[ -n "$pgrep_out" ]] || fail "pbm-agent not running after restart"
pass "systemctl restart pbm-agent"

echo "=== all shim checks passed on $node ==="
