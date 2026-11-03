#!/bin/bash
#
# Write-only load (insert, update, delete) that lands on one shard of the
# qa-integration sharded cluster, so per-shard panels can tell a hot shard from
# the rest. It writes through mongos to an unsharded collection, hot_<shard>.writes,
# whose database has TARGET_SHARD as its primary shard: no other shard sees a write.
# Every operation goes by _id, so the shard's query and getmore counters stay as they were.
#
# Env vars (defaults):
#   TARGET_SHARD      required: rs1 or rs2, the shard to load
#   MONGO_CONTAINER   mongos
#   MONGO_URI         mongodb://root:root@localhost
#   CONTINUOUS        yes; no stops after DURATION_SECONDS (300)
#   BACKGROUND        yes detaches the loop inside the container; no blocks
#   INTERVAL_MS       20, delay between insert/update/delete cycles
#
# A second background run adds a second loop. Stop it first:
#   docker exec mongos pkill -f shard_write_traffic_<shard>.js

set -euo pipefail

TARGET_SHARD=${TARGET_SHARD:-}
MONGO_CONTAINER=${MONGO_CONTAINER:-mongos}
MONGO_URI=${MONGO_URI:-mongodb://root:root@localhost}
CONTINUOUS=${CONTINUOUS:-yes}
BACKGROUND=${BACKGROUND:-yes}
DURATION_SECONDS=${DURATION_SECONDS:-300}
INTERVAL_MS=${INTERVAL_MS:-20}

if [[ ! $TARGET_SHARD =~ ^[A-Za-z0-9_-]+$ ]]; then
  echo "TARGET_SHARD must name a shard, got '$TARGET_SHARD'." >&2
  exit 1
fi
for value in DURATION_SECONDS INTERVAL_MS; do
  if [[ ! ${!value} =~ ^[0-9]+$ ]]; then
    echo "$value must be a whole number, got '${!value}'." >&2
    exit 1
  fi
done

database=hot_$TARGET_SHARD
script=/tmp/shard_write_traffic_$TARGET_SHARD.js
log=/tmp/shard_write_traffic_$TARGET_SHARD.log

# movePrimary rather than enableSharding's primaryShard, which not every
# supported version takes; it also moves a database left on the wrong shard by an earlier run.
docker exec -i "$MONGO_CONTAINER" mongosh "$MONGO_URI" --quiet --eval "
  const shard = '$TARGET_SHARD', name = '$database', config = db.getSiblingDB('config');
  if (!config.shards.findOne({ _id: shard })) {
    throw new Error('no shard ' + shard + ' in config.shards');
  }
  try { db.getSiblingDB(name).createCollection('writes'); } catch (e) { if (e.codeName !== 'NamespaceExists') throw e; }
  if (config.databases.findOne({ _id: name }).primary !== shard) {
    db.adminCommand({ movePrimary: name, to: shard });
  }
  const primary = config.databases.findOne({ _id: name }).primary;
  if (primary !== shard) {
    throw new Error(name + ' has primary shard ' + primary + ', not ' + shard);
  }
  print(name + ' primary shard: ' + primary);"

{
  printf 'var CONTINUOUS = %s, DURATION_MS = %d, INTERVAL_MS = %d, DATABASE = "%s";\n' \
    "$([[ $CONTINUOUS == yes ]] && echo true || echo false)" "$((DURATION_SECONDS * 1000))" "$INTERVAL_MS" "$database"
  cat <<'JS'
var writes = db.getSiblingDB(DATABASE).writes;
var end = Date.now() + DURATION_MS;
var ids = [];
var i = 0;
while (CONTINUOUS || Date.now() < end) {
    var id = new ObjectId();
    writes.insertOne({ _id: id, seq: i, ts: new Date(), payload: "w".repeat(256) });
    writes.updateOne({ _id: id }, { $set: { touched: new Date() } });
    ids.push(id);
    if (ids.length > 100) {
        writes.deleteOne({ _id: ids.shift() });
    }
    i++;
    if (i % 1000 === 0) {
        print(i + " cycles, " + new Date());
    }
    sleep(INTERVAL_MS);
}
ids.forEach(function (id) { writes.deleteOne({ _id: id }); });
print("done: " + i + " cycles");
JS
} | docker exec -i "$MONGO_CONTAINER" sh -c "cat >$script"

run_cmd="mongosh '$MONGO_URI' --quiet $script"
if [[ $BACKGROUND == yes ]]; then
  docker exec -d "$MONGO_CONTAINER" sh -c "$run_cmd >>$log 2>&1"
  echo "Writing to shard $TARGET_SHARD in the background; log: $MONGO_CONTAINER:$log"
else
  docker exec "$MONGO_CONTAINER" sh -c "$run_cmd"
fi
