const collection = db.getSiblingDB('pbm_metrics_test').data;

for (let i = 0; i < 1800; i += 1) {
  collection.insertOne({ i, t: new Date() });
  sleep(1000);
}
