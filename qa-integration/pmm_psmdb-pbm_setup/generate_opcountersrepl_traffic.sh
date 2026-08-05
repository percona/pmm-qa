#!/bin/bash
#
# generate_opcountersrepl_traffic.sh
#
# Generates a steady stream of insert/update/delete operations against a
# qa-integration PSMDB cluster so that
# mongodb_ss_opcountersRepl{legacy_op_type=~"insert|update|delete"} has
# non-zero test data in Grafana/PMM. Works against either topology:
#   - the sharded cluster (docker-compose-sharded*.yaml)      -> connect via mongos
#   - a plain replica set (docker-compose-rs.yaml)            -> connect via the primary (rs101)
# The script detects which one it's talking to (via isMaster().msg == "isdbgrid")
# and only runs the sharding setup commands when actually connected to a mongos.
#
# IMPORTANT: opcountersRepl is only ever reported by mongod replica-set members
# (it counts ops applied from the oplog during replication). mongos routers
# never expose this field at all, so:
#   - on the sharded cluster, point your panel's service_name at the shard/
#     config-server members, never at the mongos service. Every node started
#     by start-sharded.sh / start-sharded-with-pmm.sh shares the same random
#     suffix as the mongos service, e.g. if your mongos PMM service is
#     "mongos_31226" the matching mongod services are:
#       rs101_31226 rs102_31226 rs103_31226 rs201_31226 rs202_31226 rs203_31226
#       rscfg01_31226 rscfg02_31226 rscfg03_31226
#   - on a plain replica set, point it at the secondaries (rs102_<suffix>,
#     rs103_<suffix>), not the primary (rs101_<suffix>) -- the primary applies
#     writes directly, only secondaries apply them via replication.
# Also note some dashboards restrict their service_name variable to services
# that expose a mongos-only metric (e.g. mongodb_mongos_sharding_shards_total,
# behind listShards, which MongoDB only runs on mongos) -- on a dashboard like
# that, no mongod service (shard member, config server, or plain replica set
# member) will ever appear as an option, regardless of topology or traffic.
#
# Usage (run from qa-integration/pmm_psmdb-pbm_setup, same cwd as start-sharded.sh
# / start-rs.sh / start-rs-only.sh):
#   ./generate_opcountersrepl_traffic.sh
#
# Env vars:
#   COMPOSE_FILE      docker-compose-sharded.yaml (default), or
#                     docker-compose-sharded-with-pmm.yaml, or docker-compose-rs.yaml
#   MONGO_SERVICE     compose service to connect through (default: mongos)
#                     use rs101 for the plain replica set setup
#   MONGO_URI         default: mongodb://root:root@localhost
#                     use mongodb://root:root@localhost/?replicaSet=rs for the
#                     plain replica set setup
#   DURATION_SECONDS  how long to generate traffic for (default: 300)
#   INTERVAL_MS       delay between op cycles in ms (default: 200)

set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose-sharded.yaml}
MONGO_SERVICE=${MONGO_SERVICE:-mongos}
DURATION_SECONDS=${DURATION_SECONDS:-300}
INTERVAL_MS=${INTERVAL_MS:-200}
MONGO_URI=${MONGO_URI:-mongodb://root:root@localhost}

echo "compose file:    $COMPOSE_FILE"
echo "mongo service:   $MONGO_SERVICE"
echo "mongo uri:       $MONGO_URI"
echo "duration:        ${DURATION_SECONDS}s"
echo "interval:        ${INTERVAL_MS}ms"
echo

# Newer PSMDB images only ship mongosh, older ones only ship the legacy
# `mongo` shell -- both understand the plain JS below, so just pick whichever
# is present in the container instead of hardcoding one.
MONGO_BIN=$(docker compose -f "$COMPOSE_FILE" exec -T "$MONGO_SERVICE" bash -c 'command -v mongosh || command -v mongo')
echo "using shell binary: $MONGO_BIN"
echo

docker compose -f "$COMPOSE_FILE" exec -T "$MONGO_SERVICE" "$MONGO_BIN" "$MONGO_URI" --quiet <<EOF
// isdbgrid is the magic string mongos (and only mongos) returns here --
// use it to decide whether sharding setup is applicable at all.
var isMongos = false;
try { isMongos = (db.isMaster().msg === "isdbgrid"); } catch (e) {}

if (isMongos) {
    sh.enableSharding("test");
    try {
        sh.shardCollection("test.opload", { _id: "hashed" });
    } catch (e) {
        print("shardCollection: " + e);
    }
}

var opdb = db.getSiblingDB("test");
var coll = opdb.opload;
var durationMs = ${DURATION_SECONDS} * 1000;
var intervalMs = ${INTERVAL_MS};
var endTime = new Date().getTime() + durationMs;
var windowSize = 50;
var ids = [];
var i = 0;

print((isMongos ? "mongos" : "replica set") + " detected");
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
echo "secondary directly, e.g.:"
echo "  docker compose -f $COMPOSE_FILE exec -T rs102 \$MONGO_BIN --quiet --eval 'rs.secondaryOk(); db.serverStatus().opcountersRepl'"
echo "and point your Grafana panel's service_name at that secondary's mongod service"
echo "(rs102_<suffix>, rs103_<suffix>, rs202_<suffix>, rs203_<suffix>, ...) rather than the mongos/primary service."
