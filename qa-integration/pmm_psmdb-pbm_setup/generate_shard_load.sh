#!/bin/bash
#
# Load on a single shard of the sharded cluster (pmm-framework
# --database psmdb,SETUP_TYPE=sharding), rs2 unless SHARD says otherwise.
#
# It runs through mongos against LOAD_DB, a database whose primary shard is moved
# to SHARD and whose collections are never sharded, so every operation lands on
# that shard alone: writes and TTL deletes on its primary, oplog apply on its
# secondaries, and the secondaryPreferred scans on a secondary.
#
# The framework's own workload, generate_opcountersrepl_traffic.sh and the
# chunk-churn container, still touches both shards; stop it for an idle rs1.
#
# Usage: generate_shard_load.sh [start|stop]
#
# Env vars (defaults):
#   SHARD             rs2
#   LOAD_DB           <SHARD>_load
#   MONGOS_CONTAINER  mongos
#   MONGO_URI         mongodb://root:root@127.0.0.1:27017/admin
#   CONTINUOUS        yes; no stops after DURATION_SECONDS (300)
#   BACKGROUND        yes detaches the loop inside the container; no blocks
#   INTERVAL_MS       100, delay between op cycles
#   TTL_SECONDS       60, expiry of <LOAD_DB>.ttlload
#   SEED_DOCS         10000, documents in <LOAD_DB>.seed for the reads

set -euo pipefail

ACTION=${1:-start}
SHARD=${SHARD:-rs2}
LOAD_DB=${LOAD_DB:-${SHARD}_load}
MONGOS_CONTAINER=${MONGOS_CONTAINER:-mongos}
MONGO_URI=${MONGO_URI:-mongodb://root:root@127.0.0.1:27017/admin}
CONTINUOUS=${CONTINUOUS:-yes}
BACKGROUND=${BACKGROUND:-yes}
DURATION_SECONDS=${DURATION_SECONDS:-300}
INTERVAL_MS=${INTERVAL_MS:-100}
TTL_SECONDS=${TTL_SECONDS:-60}
SEED_DOCS=${SEED_DOCS:-10000}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

for name in SHARD LOAD_DB; do
  [[ ${!name} =~ ^[A-Za-z0-9_-]+$ ]] || die "$name must be letters, digits, '_' or '-'."
done
for name in DURATION_SECONDS INTERVAL_MS TTL_SECONDS SEED_DOCS; do
  [[ ${!name} =~ ^(0|[1-9][0-9]*)$ ]] || die "$name must be a non-negative integer."
done

prepare_js=/tmp/shard_load_${SHARD}_prepare.js
load_js=/tmp/shard_load_$SHARD.js
log=/tmp/shard_load_$SHARD.log
pidfile=/tmp/shard_load_$SHARD.pid

running() {
  docker exec "$MONGOS_CONTAINER" sh -c 'kill -0 "$(cat "$1" 2>/dev/null)" 2>/dev/null' sh "$pidfile"
}

stop_load() {
  if running; then
    docker exec "$MONGOS_CONTAINER" sh -c 'kill "$(cat "$1")" && rm -f "$1"' sh "$pidfile"
    echo "Stopped the load on shard $SHARD."
  else
    echo "No load is running on shard $SHARD."
  fi
}

# Usage: put_js PATH  (the JS on stdin, after the shared config vars)
put_js() {
  {
    echo "var SHARD='$SHARD'; var LOAD_DB='$LOAD_DB'; var CONTINUOUS=$([[ $CONTINUOUS == yes ]] && echo true || echo false);"
    echo "var DURATION_MS=$((DURATION_SECONDS * 1000)); var INTERVAL_MS=$INTERVAL_MS; var TTL_SECONDS=$TTL_SECONDS; var SEED_DOCS=$SEED_DOCS;"
    cat
  } | docker exec -i "$MONGOS_CONTAINER" sh -c 'cat > "$1"' sh "$1"
}

case $ACTION in
  start) ;;
  stop)
    stop_load
    exit 0
    ;;
  *) die "Usage: $0 [start|stop]" ;;
esac

[[ $(docker inspect -f '{{.State.Running}}' "$MONGOS_CONTAINER" 2>/dev/null) == true ]] ||
  die "Container $MONGOS_CONTAINER is not running; set up the cluster with pmm-framework --database psmdb,SETUP_TYPE=sharding."
if running; then
  die "Load on shard $SHARD is already running; stop it first with: $0 stop"
fi

put_js "$prepare_js" <<'JS'
const admin = db.getSiblingDB("admin");
const config = db.getSiblingDB("config");
if (admin.runCommand({ hello: 1 }).msg !== "isdbgrid") throw new Error("MONGO_URI must point at a mongos");
const shards = config.shards.find().toArray().map((s) => s._id);
if (!shards.includes(SHARD)) throw new Error(`No shard ${SHARD}; the cluster has ${shards.join(", ")}`);

const d = db.getSiblingDB(LOAD_DB);
for (const name of ["opload", "ttlload", "seed"]) {
  if (!d.getCollectionNames().includes(name)) d.createCollection(name);
}
if (config.databases.findOne({ _id: LOAD_DB }).primary !== SHARD) {
  const res = admin.runCommand({ movePrimary: LOAD_DB, to: SHARD });
  if (res.ok !== 1) throw new Error(`movePrimary ${LOAD_DB} to ${SHARD}: ${res.errmsg}`);
}
const primary = config.databases.findOne({ _id: LOAD_DB }).primary;
if (primary !== SHARD) throw new Error(`${LOAD_DB} is still on ${primary}`);

for (let n = d.seed.countDocuments(); n < SEED_DOCS; ) {
  const batch = [];
  for (; n < SEED_DOCS && batch.length < 1000; n++) {
    batch.push({ n, group: n % 50, amount: Math.floor(Math.random() * 1000), ts: new Date(), payload: "s".repeat(256) });
  }
  d.seed.insertMany(batch);
}
d.seed.createIndex({ group: 1, amount: -1 });
try {
  d.ttlload.createIndex({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });
} catch (e) {
  d.runCommand({ collMod: "ttlload", index: { keyPattern: { createdAt: 1 }, expireAfterSeconds: TTL_SECONDS } });
}
print(`${LOAD_DB} is on shard ${primary}, ${d.seed.countDocuments()} seed documents`);
JS

put_js "$load_js" <<'JS'
const d = db.getSiblingDB(LOAD_DB);
const endTime = CONTINUOUS ? null : Date.now() + DURATION_MS;
const ids = [];
let i = 0;
print(`${new Date().toISOString()} load on shard ${SHARD} via ${LOAD_DB}, ` + (CONTINUOUS ? "continuous" : `${DURATION_MS / 1000}s`));
while (CONTINUOUS || Date.now() < endTime) {
  // A failover on the shard must not end the run.
  try {
    const doc = { _id: new ObjectId(), seq: i, ts: new Date(), payload: "x".repeat(128) };
    d.opload.insertOne(doc);
    d.opload.updateOne({ _id: doc._id }, { $set: { touched: new Date() } });
    ids.push(doc._id);
    if (ids.length > 50) d.opload.deleteOne({ _id: ids.shift() });
    d.ttlload.insertOne({ createdAt: new Date(), seq: i, payload: "y".repeat(64) });

    const group = i % 50;
    d.seed.find({ group, amount: { $gte: 500 } }).sort({ amount: -1 }).limit(20).toArray();
    if (i % 10 === 0) {
      d.seed.aggregate([{ $match: { group } }, { $group: { _id: "$group", total: { $sum: "$amount" }, n: { $sum: 1 } } }]).toArray();
    }
    if (i % 25 === 0) {
      d.seed.find({ amount: { $lt: 100 } }).readPref("secondaryPreferred").batchSize(101).toArray();
    }
  } catch (e) {
    print(`${new Date().toISOString()} cycle ${i} failed: ${e.message}`);
    sleep(1000);
  }
  i++;
  if (i % 1000 === 0) print(`${new Date().toISOString()} ${i} cycles`);
  sleep(INTERVAL_MS);
}
ids.forEach((id) => d.opload.deleteOne({ _id: id }));
print(`${new Date().toISOString()} done: ${i} cycles`);
JS

docker exec "$MONGOS_CONTAINER" mongosh "$MONGO_URI" --quiet "$prepare_js" ||
  die "Preparing $LOAD_DB on shard $SHARD failed."

# shellcheck disable=SC2016 # expanded by the container's shell
run_load='echo $$ > "$1"; exec mongosh "$2" --quiet "$3"'
if [[ $BACKGROUND == yes ]]; then
  docker exec -d "$MONGOS_CONTAINER" sh -c "$run_load > \"\$4\" 2>&1" sh "$pidfile" "$MONGO_URI" "$load_js" "$log"
  sleep 5
  if ! running && ! docker exec "$MONGOS_CONTAINER" grep -q ' done: ' "$log"; then
    die "The load exited: $(docker exec "$MONGOS_CONTAINER" tail -n 20 "$log")"
  fi
  echo "Load is running on shard $SHARD in the background."
  echo "  tail it:  docker exec $MONGOS_CONTAINER tail -f $log"
  echo "  stop it:  $0 stop"
else
  docker exec "$MONGOS_CONTAINER" sh -c "$run_load" sh "$pidfile" "$MONGO_URI" "$load_js" &
  # docker exec does not pass a signal on to the process it runs.
  trap 'stop_load; exit 130' INT TERM
  wait $!
fi
