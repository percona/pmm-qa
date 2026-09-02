// Keeps config.changelog producing split and moveChunk entries for the sharded
// setup. mongodb_mongos_sharding_changelog_10min_total only reports events from
// the last 10 minutes, and MongoDB 7.0+ removed auto-splitting, so after the
// initial shardCollection there is nothing left to keep the Chunks Split/Move
// Events panels populated.
//
// This script performs exactly ONE churn cycle and exits. The repeat loop lives
// in the compose entrypoint, wrapped in `timeout`, because a chunk command can
// block indefinitely inside the server: a wedged range deleter leaves both
// moveChunk and any later splitChunk on the same collection waiting forever.
// When the loop ran in-process here, one such wedge stopped the whole loop --
// mongosh stayed alive, so `restart: unless-stopped` never fired -- and every
// event aged out of the 10-minute window, blanking both panels for the rest of
// the run. A fresh short-lived process per cycle makes that unrecoverable state
// impossible.

const ns = process.env.CHURN_NAMESPACE || 'test.test';
const maxChunks = Number(process.env.CHURN_MAX_CHUNKS || 64);
// Soft bound so an abandoned command does not keep running server-side after
// the entrypoint's `timeout` has already killed this process.
const commandTimeoutMs = Number(process.env.CHURN_COMMAND_TIMEOUT_SECONDS || 45) * 1000;
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

// Sending a range straight back to the shard that just gave it up is what wedges
// the range deleter: the recipient still has orphans from the previous move, and
// each retry adds another pending deletion. Draining onto the least-loaded shard
// instead follows the same direction the balancer would, so a range only returns
// once the counts have genuinely swung back.
function leastLoadedShard(shards, filter, exclude) {
  const candidates = shards.filter((shard) => shard !== exclude);

  if (!candidates.length) return null;

  return candidates
    .map((shard) => ({ shard, n: config.chunks.countDocuments(Object.assign({ shard }, filter)) }))
    .sort((a, b) => a.n - b.n)[0].shard;
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
  const target = chunk ? leastLoadedShard(shards, filter, chunk.shard) : null;

  if (chunk && target) {
    // No _waitForDelete: blocking this command until the donor's range deleter
    // finishes is what let a single stuck deletion wedge the cycle. The deleter
    // runs on its own in the background, and the panels match every *moveChunk*
    // event -- moveChunk.start and moveChunk.error included -- so a cycle that
    // loses the race to orphan cleanup still keeps the series alive.
    attempt('moveChunk', {
      moveChunk: ns,
      bounds: [chunk.min, chunk.max],
      to: target,
    });
  }

  mergeIfAboveCeiling(shards, filter);
}
