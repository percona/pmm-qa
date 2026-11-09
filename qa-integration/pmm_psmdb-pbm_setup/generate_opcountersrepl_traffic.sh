#!/bin/bash
#
# Continuous insert/update/delete/read and TTL-expiry load on a qa-integration
# PSMDB cluster, so every "Command Operations" series has data: opcounters,
# opcountersRepl (secondaries applying the oplog) and ttl_deletedDocuments.
# The sharded cluster goes through mongos, a replica set through rs101.
#
# opcountersRepl exists only on replica-set members, never on mongos: point the
# panel at the shard/config members, or at a replica set's secondaries.
#
# Run from qa-integration/pmm_psmdb-pbm_setup. Env vars (defaults):
#   COMPOSE_FILE      docker-compose-sharded.yaml, or docker-compose-rs.yaml
#   MONGO_SERVICE     mongos (rs101 for a replica set)
#   MONGO_URI         mongodb://root:root@localhost (add /?replicaSet=rs for one)
#   CONTINUOUS        yes; no stops after DURATION_SECONDS (300)
#   BACKGROUND        yes detaches the loop inside the container; no blocks
#   INTERVAL_MS       200, delay between op cycles
#   TTL_SECONDS       60, expiry of test.ttlload
#   READ_COLLECTION   test, the collection scanned to drive query/getMore

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


cont_bool=false
[ "$CONTINUOUS" = "yes" ] && cont_bool=true

# Config the JS reads. Injected as plain vars so the JS body below can stay a
# quoted heredoc (no shell-vs-mongo '$operator' escaping headaches).
config_js="var CONTINUOUS=${cont_bool}; var DURATION_MS=$((DURATION_SECONDS * 1000)); var INTERVAL_MS=${INTERVAL_MS}; var TTL_SECONDS=${TTL_SECONDS}; var READ_COLLECTION='${READ_COLLECTION}';"

{
  echo "$config_js"
  cat <<'JS'
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

run_cmd="mongosh \"$MONGO_URI\" --quiet /tmp/opcounters_traffic.js"

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