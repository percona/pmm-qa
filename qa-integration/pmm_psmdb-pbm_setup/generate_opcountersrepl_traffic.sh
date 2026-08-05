#!/bin/bash
#
# generate_opcountersrepl_traffic.sh
#
# Generates a *continuous* stream of insert/update/delete/read + TTL-expiry
# operations against a qa-integration PSMDB cluster so the PMM/Grafana
# "Command Operations" panel actually has live data. It feeds every series that
# panel plots:
#
#   mongodb_ss_opcounters{legacy_op_type="insert|update|delete|query|getmore"}
#       -> insert/update/delete come from the write loop, query/getmore come
#          from the read loop (a batched cursor scan that forces getMore).
#   mongodb_ss_opcountersRepl{legacy_op_type="insert|update|delete"}
#       -> the same writes as they are applied from the oplog on secondaries.
#   mongodb_ss_metrics_ttl_deletedDocuments
#       -> a collection with a TTL index (test.ttlload, expireAfterSeconds=
#          $TTL_SECONDS) that the loop keeps feeding, so the per-mongod TTL
#          monitor deletes expired docs every ~60s forever.
#
# Works against either topology (auto-detected via isMaster().msg=="isdbgrid"):
#   - sharded cluster (docker-compose-sharded*.yaml)  -> connect via mongos
#   - plain replica set (docker-compose-rs.yaml)      -> connect via primary rs101
#
# By default it runs CONTINUOUS=yes / BACKGROUND=yes: the load loop is launched
# *detached inside the mongo container* and keeps running after this script (and
# the setup that called it) returns, so the panel keeps showing data until the
# environment is torn down. Set CONTINUOUS=no for a bounded run, or BACKGROUND=no
# to run in the foreground (useful for debugging).
#
# WHERE TO POINT THE PANEL (this is the other half of "panel is empty"):
#   opcountersRepl is only ever reported by mongod replica-set members (it counts
#   ops applied from the oplog); mongos routers never expose it. So on the sharded
#   cluster point the panel's service_name at the shard/config members, NOT only
#   at the mongos. Every node started by start-sharded.sh / start-sharded-with-pmm.sh
#   shares the mongos' random suffix, e.g. for mongos service "mongos_31226":
#       rs101_31226 rs102_31226 rs103_31226 rs201_31226 rs202_31226 rs203_31226
#       rscfg01_31226 rscfg02_31226 rscfg03_31226
#   On a plain replica set point it at the secondaries (rs102_/rs103_), not the
#   primary -- the primary applies writes directly, only secondaries apply them
#   via replication. (opcounters/query B/C do show on the primary and mongos too.)
#
# Usage (run from qa-integration/pmm_psmdb-pbm_setup):
#   ./generate_opcountersrepl_traffic.sh
#
# Env vars:
#   COMPOSE_FILE      docker-compose-sharded.yaml (default), or
#                     docker-compose-sharded-with-pmm.yaml, or docker-compose-rs.yaml
#   MONGO_SERVICE     compose service to connect through (default: mongos;
#                     use rs101 for the plain replica set setup)
#   MONGO_URI         default: mongodb://root:root@localhost
#                     use mongodb://root:root@localhost/?replicaSet=rs for a
#                     plain replica set
#   CONTINUOUS        yes (default) = run forever; no = stop after DURATION_SECONDS
#   BACKGROUND        yes (default) = detach the loop inside the container; no =
#                     run in the foreground and block
#   DURATION_SECONDS  bounded-run length when CONTINUOUS=no (default: 300)
#   INTERVAL_MS       delay between op cycles in ms (default: 200)
#   TTL_SECONDS       TTL index expiry for test.ttlload (default: 60)
#   READ_COLLECTION   collection in db "test" scanned to drive query/getMore
#                     (default: test -- the mgodatagen collection created by the
#                     setup scripts)

set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose-sharded.yaml}
MONGO_SERVICE=${MONGO_SERVICE:-mongos}
MONGO_URI=${MONGO_URI:-mongodb://root:root@localhost}
CONTINUOUS=${CONTINUOUS:-yes}
BACKGROUND=${BACKGROUND:-yes}
DURATION_SECONDS=${DURATION_SECONDS:-300}
INTERVAL_MS=${INTERVAL_MS:-200}
TTL_SECONDS=${TTL_SECONDS:-60}
READ_COLLECTION=${READ_COLLECTION:-test}

echo "compose file:    $COMPOSE_FILE"
echo "mongo service:   $MONGO_SERVICE"
echo "mongo uri:       $MONGO_URI"
echo "continuous:      $CONTINUOUS"
echo "background:      $BACKGROUND"
echo "interval:        ${INTERVAL_MS}ms"
echo "ttl expiry:      ${TTL_SECONDS}s"
echo "read collection: test.${READ_COLLECTION}"
echo

# Newer PSMDB images only ship mongosh, older ones only ship the legacy `mongo`
# shell -- both understand the JS below, so pick whichever is present.
MONGO_BIN=$(docker compose -f "$COMPOSE_FILE" exec -T "$MONGO_SERVICE" bash -c 'command -v mongosh || command -v mongo' | tr -d '\r')
echo "using shell binary: $MONGO_BIN"
echo

cont_bool=false
[ "$CONTINUOUS" = "yes" ] && cont_bool=true

# Config the JS reads. Injected as plain vars so the JS body below can stay a
# quoted heredoc (no shell-vs-mongo '$operator' escaping headaches).
config_js="var CONTINUOUS=${cont_bool}; var DURATION_MS=$((DURATION_SECONDS * 1000)); var INTERVAL_MS=${INTERVAL_MS}; var TTL_SECONDS=${TTL_SECONDS}; var READ_COLLECTION='${READ_COLLECTION}';"

# Build the full program (config + one-time setup + the load loop) and write it
# into the container so we can run it detached.
{
  echo "$config_js"
  cat <<'JS'
// ---- one-time setup ---------------------------------------------------------
var isMongos = false;
try { isMongos = (db.isMaster().msg === "isdbgrid"); } catch (e) {}
print((isMongos ? "mongos" : "replica set") + " detected");

var t = db.getSiblingDB("test");

if (isMongos) {
    try { sh.enableSharding("test"); } catch (e) { print("enableSharding: " + e); }
    try { sh.shardCollection("test.opload", { _id: "hashed" }); } catch (e) { print("shardCollection opload: " + e); }
    try { sh.shardCollection("test.ttlload", { _id: "hashed" }); } catch (e) { print("shardCollection ttlload: " + e); }
}
// TTL index so the per-mongod TTL monitor keeps deleting expired docs ->
// mongodb_ss_metrics_ttl_deletedDocuments. On a sharded collection each shard's
// primary runs its own TTL monitor, and the deletes replicate to secondaries.
try { t.ttlload.createIndex({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS }); }
catch (e) { print("createIndex ttl: " + e); }

var opload  = t.opload;
var ttlload = t.ttlload;
var readColl = t[READ_COLLECTION];

var endTime = CONTINUOUS ? null : (new Date().getTime() + DURATION_MS);
var windowSize = 50;
var ids = [];
var i = 0;

print("generating insert/update/delete/read + TTL traffic against db 'test' " +
      (CONTINUOUS ? "continuously ..." : "for " + (DURATION_MS / 1000) + "s ..."));

// ---- load loop --------------------------------------------------------------
while (CONTINUOUS || new Date().getTime() < endTime) {
    // insert + update + rolling delete -> opcounters/opcountersRepl insert/update/delete
    var doc = { _id: new ObjectId(), seq: i, ts: new Date(), payload: "x".repeat(128) };
    opload.insertOne(doc);
    opload.updateOne({ _id: doc._id }, { $set: { touched: new Date() } });
    ids.push(doc._id);
    if (ids.length > windowSize) {
        opload.deleteOne({ _id: ids.shift() });
    }

    // feed the TTL collection -> these expire after TTL_SECONDS and get reaped
    // by the TTL monitor (ttl.deletedDocuments) and replicated as deletes.
    ttlload.insertOne({ createdAt: new Date(), seq: i, payload: "y".repeat(64) });

    // periodic batched scan -> query + getMore opcounters
    if (i % 25 === 0) {
        try {
            var c = readColl.find().batchSize(101);
            var n = 0;
            while (c.hasNext()) { c.next(); n++; if (n > 500) break; }
        } catch (e) { /* read collection may be empty; ignore */ }
    }

    i++;
    if (i % 100 === 0) {
        print(i + " cycles, " + new Date());
    }
    sleep(INTERVAL_MS);
}

// bounded-run cleanup: drain the rolling window so we don't leave orphan docs
ids.forEach(function (id) { opload.deleteOne({ _id: id }); });
print("done: " + i + " cycles");
JS
} | docker compose -f "$COMPOSE_FILE" exec -T "$MONGO_SERVICE" bash -c 'cat > /tmp/opcounters_traffic.js'

run_cmd="$MONGO_BIN \"$MONGO_URI\" --quiet /tmp/opcounters_traffic.js"

if [ "$BACKGROUND" = "yes" ]; then
    echo "launching load loop detached inside '$MONGO_SERVICE' (logs: /tmp/opcounters_traffic.log)"
    docker compose -f "$COMPOSE_FILE" exec -d "$MONGO_SERVICE" \
        bash -c "$run_cmd >> /tmp/opcounters_traffic.log 2>&1"
    # give it a moment and surface the first lines so failures aren't silent
    sleep 8
    echo "----- first output from the load loop -----"
    docker compose -f "$COMPOSE_FILE" exec -T "$MONGO_SERVICE" \
        bash -c 'tail -n 15 /tmp/opcounters_traffic.log 2>/dev/null || echo "(no log yet)"'
    echo "-------------------------------------------"
    echo
    echo "Load is now running continuously in the background."
    echo "  tail it:  docker compose -f $COMPOSE_FILE exec -T $MONGO_SERVICE tail -f /tmp/opcounters_traffic.log"
    echo "  stop it:  docker compose -f $COMPOSE_FILE exec -T $MONGO_SERVICE pkill -f opcounters_traffic.js"
else
    echo "running load loop in the foreground (Ctrl-C to stop) ..."
    docker compose -f "$COMPOSE_FILE" exec -T "$MONGO_SERVICE" bash -c "$run_cmd"
fi

echo
echo "Point the 'Command Operations' panel's service_name at the shard/config"
echo "members (rs1xx_/rs2xx_/rscfg0x_<suffix>), not only the mongos, so the"
echo "opcountersRepl series has data too."
