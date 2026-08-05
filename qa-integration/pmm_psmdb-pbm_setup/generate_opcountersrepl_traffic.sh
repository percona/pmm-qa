#!/bin/bash
#
# generate_opcountersrepl_traffic.sh
#
# Generates a steady stream of insert/update/delete operations against the
# qa-integration sharded PSMDB cluster (pmm_psmdb-pbm_setup/docker-compose-sharded*.yaml)
# so that mongodb_ss_opcountersRepl{legacy_op_type=~"insert|update|delete"} has
# non-zero test data in Grafana/PMM.
#
# IMPORTANT: opcountersRepl is only ever reported by mongod replica-set members
# (it counts ops applied from the oplog during replication). mongos routers
# never expose this field, so a PromQL filter like service_name=~"mongos_XXXXX"
# will always be empty for this metric -- no amount of load changes that.
# Point your panel at the shard/config-server members instead. Every node
# started by start-sharded.sh / start-sharded-with-pmm.sh shares the same
# random suffix as the mongos service, e.g. if your mongos PMM service is
# "mongos_31226" the matching mongod services are:
#   rs101_31226 rs102_31226 rs103_31226 rs201_31226 rs202_31226 rs203_31226
#   rscfg01_31226 rscfg02_31226 rscfg03_31226
# (rs102/rs103/rs202/rs203 are normally the secondaries, which is where
# opcountersRepl actually climbs -- the primary of each shard applies writes
# directly, not via replication.)
#
# Usage (run from qa-integration/pmm_psmdb-pbm_setup, same cwd as start-sharded.sh):
#   ./generate_opcountersrepl_traffic.sh
#
# Env vars:
#   COMPOSE_FILE       docker-compose-sharded.yaml (default) or
#                       docker-compose-sharded-with-pmm.yaml
#   MONGOS_SERVICE      compose service name for the router (default: mongos)
#   DURATION_SECONDS    how long to generate traffic for (default: 300)
#   INTERVAL_MS         delay between op cycles in ms (default: 200)
#   MONGO_URI           default: mongodb://root:root@localhost

set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose-sharded.yaml}
MONGOS_SERVICE=${MONGOS_SERVICE:-mongos}
DURATION_SECONDS=${DURATION_SECONDS:-300}
INTERVAL_MS=${INTERVAL_MS:-200}
MONGO_URI=${MONGO_URI:-mongodb://root:root@localhost}

echo "compose file:    $COMPOSE_FILE"
echo "mongos service:  $MONGOS_SERVICE"
echo "duration:        ${DURATION_SECONDS}s"
echo "interval:        ${INTERVAL_MS}ms"
echo

# Newer PSMDB images only ship mongosh, older ones only ship the legacy
# `mongo` shell -- both understand the plain JS below, so just pick whichever
# is present in the container instead of hardcoding one.
MONGO_BIN=$(docker compose -f "$COMPOSE_FILE" exec -T "$MONGOS_SERVICE" bash -c 'command -v mongosh || command -v mongo')
echo "using shell binary: $MONGO_BIN"
echo

docker compose -f "$COMPOSE_FILE" exec -T "$MONGOS_SERVICE" "$MONGO_BIN" "$MONGO_URI" --quiet <<EOF
sh.enableSharding("test");
try {
    sh.shardCollection("test.opload", { _id: "hashed" });
} catch (e) {
    print("shardCollection: " + e);
}

var opdb = db.getSiblingDB("test");
var coll = opdb.opload;
var durationMs = ${DURATION_SECONDS} * 1000;
var intervalMs = ${INTERVAL_MS};
var endTime = new Date().getTime() + durationMs;
var windowSize = 50;
var ids = [];
var i = 0;

print("generating insert/update/delete traffic against test.opload for ${DURATION_SECONDS}s ...");

while (new Date().getTime() < endTime) {
    var doc = { _id: new ObjectId(), seq: i, ts: new Date(), payload: "x".repeat(128) };
    coll.insertOne(doc);
    coll.updateOne({ _id: doc._id }, { \$set: { touched: new Date() } });
    ids.push(doc._id);
    if (ids.length > windowSize) {
        var oldId = ids.shift();
        coll.deleteOne({ _id: oldId });
    }
    i++;
    if (i % 50 == 0) {
        print(i + " iterations, " + new Date());
    }
    sleep(intervalMs);
}

// drain whatever is left in the rolling window so we don't leave orphan docs
ids.forEach(function(id) { coll.deleteOne({ _id: id }); });

print("done: " + i + " insert/update cycles");
EOF

echo
echo "Load generation finished. To confirm opcountersRepl actually moved, check a"
echo "shard secondary directly, e.g.:"
echo "  docker compose -f $COMPOSE_FILE exec -T rs102 \$MONGO_BIN --quiet --eval 'rs.secondaryOk(); db.serverStatus().opcountersRepl'"
echo "and point your Grafana panel's service_name at the mongod members"
echo "(rs102_<suffix>, rs103_<suffix>, rs202_<suffix>, rs203_<suffix>, ...) rather than the mongos service."
