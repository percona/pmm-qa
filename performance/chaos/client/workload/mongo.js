// 50 collections, insert/find/update/aggregate/delete on each, then 1s pause, forever.
// The profiler (level 2, slowms 0) records all of it for QAN.
const p = db.getSiblingDB('perf');
for (let i = 0; i < 50; i++) p['c' + i].createIndex({ k: 1 });
while (true) {
  for (let i = 0; i < 50; i++) {
    const c = p['c' + i];
    const k = Math.floor(Math.random() * 1000);
    c.insertOne({ k: k, v: Math.random(), t: new Date() });
    c.find({ k: k }).toArray();
    c.updateMany({ k: { $gt: k, $lt: k + 20 } }, { $inc: { n: 1 } });
    c.aggregate([{ $match: { k: { $lt: k } } }, { $group: { _id: null, a: { $avg: '$v' } } }]).toArray();
    c.deleteMany({ k: (k + 500) % 1000 });
  }
  sleep(1000);
}
