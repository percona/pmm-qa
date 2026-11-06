#!/bin/bash
#
# A load that lands on one shard of the qa-integration sharded cluster, so
# per-shard panels can tell a hot shard from the rest. It goes through mongos to
# unsharded collections of hot_<shard>, a database with TARGET_SHARD as its primary
# shard, so no other shard sees it.
#
# LOAD=write: insert, update and delete by _id on hot_<shard>.writes, with w:1 so
# one loop keeps the shard busy. It sends no client reads, though the secondaries'
# oplog getMores on the shard's primary still rise with it.
# LOAD=scan: queries an unindexed field of hot_<shard>.scans, SCAN_DOCS documents
# seeded once, so each query examines every document and returns one.
#
# Env vars (defaults):
#   TARGET_SHARD      required: rs1 or rs2, the shard to load
#   LOAD              write, or scan
#   SCAN_DOCS         20000, documents in hot_<shard>.scans
#   MONGO_CONTAINER   mongos
#   MONGO_URI         mongodb://root:root@localhost
#   CONTINUOUS        yes; no stops after DURATION_SECONDS (300)
#   BACKGROUND        yes detaches the loop inside the container; no blocks
#   INTERVAL_MS       delay between cycles: 5 for write, 50 for scan
#
# A second background run adds a second loop. Stop it first:
#   docker exec mongos pkill -f shard_<load>_traffic_<shard>.js

set -euo pipefail

TARGET_SHARD=${TARGET_SHARD:-}
LOAD=${LOAD:-write}
SCAN_DOCS=${SCAN_DOCS:-20000}
MONGO_CONTAINER=${MONGO_CONTAINER:-mongos}
MONGO_URI=${MONGO_URI:-mongodb://root:root@localhost}
CONTINUOUS=${CONTINUOUS:-yes}
BACKGROUND=${BACKGROUND:-yes}
DURATION_SECONDS=${DURATION_SECONDS:-300}

if [[ ! $TARGET_SHARD =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "TARGET_SHARD must name a shard, got '$TARGET_SHARD'." >&2
  exit 1
fi
case $LOAD in
  write) INTERVAL_MS=${INTERVAL_MS:-5} ;;
  scan) INTERVAL_MS=${INTERVAL_MS:-50} ;;
  *)
    echo "LOAD must be write or scan, got '$LOAD'." >&2
    exit 1
    ;;
esac
for value in DURATION_SECONDS INTERVAL_MS; do
  if [[ ! ${!value} =~ ^[0-9]+$ ]]; then
    echo "$value must be a whole number, got '${!value}'." >&2
    exit 1
  fi
done
if [[ ! $SCAN_DOCS =~ ^[1-9][0-9]*$ ]]; then
  echo "SCAN_DOCS must be a whole number above 0, got '$SCAN_DOCS'." >&2
  exit 1
fi

database=hot_$TARGET_SHARD
script=/tmp/shard_${LOAD}_traffic_$TARGET_SHARD.js
log=/tmp/shard_${LOAD}_traffic_$TARGET_SHARD.log

# movePrimary rather than enableSharding's primaryShard, which not every
# supported version takes; it also moves a database left on the wrong shard by an earlier run.
# The scan collection is seeded after the move, so its inserts land on the target shard only.
docker exec "$MONGO_CONTAINER" mongosh "$MONGO_URI" --quiet --eval "
  const shard = '$TARGET_SHARD', name = '$database', load = '$LOAD', docs = $SCAN_DOCS, config = db.getSiblingDB('config');
  if (!config.shards.findOne({ _id: shard })) {
    throw new Error('no shard ' + shard + ' in config.shards');
  }
  const collection = load === 'scan' ? 'scans' : 'writes';
  try { db.getSiblingDB(name).createCollection(collection); } catch (e) { if (e.codeName !== 'NamespaceExists') throw e; }
  if (config.databases.findOne({ _id: name }).primary !== shard) {
    db.adminCommand({ movePrimary: name, to: shard });
  }
  const primary = config.databases.findOne({ _id: name }).primary;
  if (primary !== shard) {
    throw new Error(name + ' has primary shard ' + primary + ', not ' + shard);
  }
  print(name + ' primary shard: ' + primary);
  if (load === 'scan') {
    const scans = db.getSiblingDB(name).scans;
    if (scans.countDocuments({}) !== docs) {
      scans.drop();
      for (let i = 0; i < docs; i += 1000) {
        scans.insertMany(Array.from({ length: Math.min(1000, docs - i) }, (_, j) => ({ _id: i + j, seq: i + j })));
      }
    }
    print(name + '.scans: ' + scans.countDocuments({}) + ' documents');
  }"

{
  printf 'var LOAD = "%s", CONTINUOUS = %s, DURATION_MS = %d, INTERVAL_MS = %d, DATABASE = "%s", SCAN_DOCS = %d;\n' \
    "$LOAD" "$([[ $CONTINUOUS == yes ]] && echo true || echo false)" "$((DURATION_SECONDS * 1000))" \
    "$INTERVAL_MS" "$database" "$SCAN_DOCS"
  if [[ $LOAD == write ]]; then
    cat <<'JS'
var writes = db.getSiblingDB(DATABASE).writes;
var W1 = { writeConcern: { w: 1 } };
var end = Date.now() + DURATION_MS;
var ids = [];
var i = 0;
while (CONTINUOUS || Date.now() < end) {
    var id = new ObjectId();
    writes.insertOne({ _id: id, seq: i, ts: new Date(), payload: "w".repeat(256) }, W1);
    writes.updateOne({ _id: id }, { $set: { touched: new Date() } }, W1);
    ids.push(id);
    if (ids.length > 100) {
        writes.deleteOne({ _id: ids.shift() }, W1);
    }
    i++;
    if (i % 10000 === 0) {
        print(i + " cycles, " + new Date());
    }
    sleep(INTERVAL_MS);
}
ids.forEach(function (id) { writes.deleteOne({ _id: id }); });
print("done: " + i + " cycles");
JS
  else
    cat <<'JS'
var scans = db.getSiblingDB(DATABASE).scans;
var end = Date.now() + DURATION_MS;
var i = 0;
while (CONTINUOUS || Date.now() < end) {
    scans.find({ seq: SCAN_DOCS - 1 }).itcount();
    i++;
    if (i % 1000 === 0) {
        print(i + " cycles, " + new Date());
    }
    sleep(INTERVAL_MS);
}
print("done: " + i + " cycles");
JS
  fi
} | docker exec -i "$MONGO_CONTAINER" sh -c "cat >$script"

run_cmd="mongosh '$MONGO_URI' --quiet $script"
if [[ $BACKGROUND == yes ]]; then
  docker exec -d "$MONGO_CONTAINER" sh -c "$run_cmd >>$log 2>&1"
  echo "Started the $LOAD load on shard $TARGET_SHARD in the background; log: $MONGO_CONTAINER:$log"
else
  docker exec "$MONGO_CONTAINER" sh -c "$run_cmd"
fi
