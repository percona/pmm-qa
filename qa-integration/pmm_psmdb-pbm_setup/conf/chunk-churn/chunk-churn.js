// Keeps config.changelog producing split and moveChunk entries for the sharded
// setup. mongodb_mongos_sharding_changelog_10min_total only reports events from
// the last 10 minutes, and MongoDB 7.0+ removed auto-splitting, so after the
// initial shardCollection there is nothing left to keep the Chunks Split/Move
// Events panels populated.
//
// One cycle per process, by design: the repeat loop is in the compose
// entrypoint under `timeout`, so a chunk command the server blocks forever
// costs one cycle instead of the run.

const ns = process.env.CHURN_NAMESPACE || 'test.test';
const maxChunks = Number(process.env.CHURN_MAX_CHUNKS || 64);
// Soft bound so an abandoned command does not keep running server-side after
// the entrypoint's `timeout` has already killed this process. maxTimeMS wants a
// positive integer: 0 means "no limit" to the server, and a fraction or Infinity
// is not a valid value at all, so anything else falls back.
const commandTimeoutSeconds = Number(process.env.CHURN_COMMAND_TIMEOUT_SECONDS);
const commandTimeoutValid = Number.isInteger(commandTimeoutSeconds) && commandTimeoutSeconds > 0;
const commandTimeoutMs = (commandTimeoutValid ? commandTimeoutSeconds : 45) * 1000;
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
    // maxTimeMS must trail the command fields: the server reads the first key
    // of the document as the command name.
    const res = admin.runCommand(Object.assign({}, command, { maxTimeMS: commandTimeoutMs }));

    if (res.ok !== 1) print(`${label} skipped: ${res.errmsg}`);
  } catch (e) {
    print(`${label} skipped: ${e.message}`);
  }
}

// One split per cycle would otherwise grow the chunk count without bound; the
// auto-merger alone does not keep up. Collapsing on a ceiling keeps it bounded
// without ever having to skip a split, so the split events never pause.
function mergeIfAboveCeiling(shards, filter) {
  if (config.chunks.countDocuments(filter) <= maxChunks) return;

  shards.forEach((shard) => attempt('mergeAllChunksOnShard', { mergeAllChunksOnShard: ns, shard }));
}

function sampleOne(collection, filter) {
  const stages = filter ? [{ $match: filter }, { $sample: { size: 1 } }] : [{ $sample: { size: 1 } }];

  return collection.aggregate(stages).toArray()[0];
}

const filter = chunkFilter();

if (!filter) {
  print(`${ns} is not sharded yet`);
} else {
  const doc = sampleOne(db.getSiblingDB(dbName).getCollection(collName));

  if (doc) attempt('split', { split: ns, find: { _id: doc._id } });

  const shards = config.shards
    .find({}, { _id: 1 })
    .toArray()
    .map((shard) => shard._id);
  const chunk = sampleOne(config.chunks, filter);
  const target = shards.find((id) => chunk && id !== chunk.shard);

  if (chunk && target) {
    attempt('moveChunk', {
      moveChunk: ns,
      bounds: [chunk.min, chunk.max],
      to: target,
    });
  }

  mergeIfAboveCeiling(shards, filter);
}
