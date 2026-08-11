// Keeps config.changelog producing split and moveChunk entries for the sharded
// setup. mongodb_mongos_sharding_changelog_10min_total only reports events from
// the last 10 minutes, and MongoDB 7.0+ removed auto-splitting, so after the
// initial shardCollection there is nothing left to keep the Chunks Split/Move
// Events panels populated.

const ns = process.env.CHURN_NAMESPACE || 'test.test';
const intervalMs = Number(process.env.CHURN_INTERVAL_SECONDS || 120) * 1000;
const dbName = ns.slice(0, ns.indexOf('.'));
const collName = ns.slice(ns.indexOf('.') + 1);
const config = db.getSiblingDB('config');
const admin = db.getSiblingDB('admin');

// config.chunks is keyed by collection uuid since 5.0 and by namespace before.
function chunkFilter() {
  const entry = config.collections.findOne({ _id: ns });

  if (!entry) return null;

  return entry.uuid ? { uuid: entry.uuid } : { ns };
}

// runCommand returns { ok: 0, errmsg } for a rejected split/move instead of
// throwing, so both shapes need reporting.
function attempt(label, command) {
  try {
    const res = admin.runCommand(command);

    if (res.ok !== 1) print(`${label} skipped: ${res.errmsg}`);
  } catch (e) {
    print(`${label} skipped: ${e.message}`);
  }
}

function sampleOne(collection, filter) {
  const stages = filter ? [{ $match: filter }, { $sample: { size: 1 } }] : [{ $sample: { size: 1 } }];

  return collection.aggregate(stages).toArray()[0];
}

print(`chunk churn on ${ns} every ${intervalMs / 1000}s`);

while (true) {
  try {
    const filter = chunkFilter();

    if (!filter) {
      print(`${ns} is not sharded yet`);
    } else {
      const doc = sampleOne(db.getSiblingDB(dbName).getCollection(collName));

      if (doc) attempt('split', { split: ns, find: { _id: doc._id } });

      const chunk = sampleOne(config.chunks, filter);
      const target = config.shards
        .find({}, { _id: 1 })
        .toArray()
        .map((shard) => shard._id)
        .find((id) => chunk && id !== chunk.shard);

      if (chunk && target) {
        // _waitForDelete keeps the range deleter in step with the churn: without it the
        // next move of a range back to its previous owner fails while orphans from the
        // last one are still being cleaned up.
        attempt('moveChunk', {
          moveChunk: ns,
          bounds: [chunk.min, chunk.max],
          to: target,
          _waitForDelete: true,
        });
      }
    }
  } catch (e) {
    print(`churn iteration failed: ${e.message}`);
  }

  sleep(intervalMs);
}
