import { MongoClient } from 'mongodb';

interface MongoConfig {
  host?: string;
  port: number;
  username: string;
  password: string;
}

export default class MongoDBHelper {
  private url: string;
  private client: MongoClient;
  private host: string;
  private port: number;

  constructor(config: MongoConfig) {
    this.host = config.host || '127.0.0.1';
    this.port = config.port || 27_017;
    this.url = `mongodb://${config.username}:${encodeURIComponent(config.password)}@${this.host}:${this.port}/?authSource=admin`;
    this.client = new MongoClient(this.url, {
      connectTimeoutMS: 30_000,
      directConnection: true,
    });
  }

  /**
   * Ensures the collection has at least n documents. Used so a find with $where
   * (per-document delay) runs long enough without exceeding server JS time limit per doc.
   */
  ensureCollectionHasDocuments = async (collectionName: string, dbName: string, minCount: number) => {
    const collection = this.client.db(dbName).collection(collectionName);
    const count = await collection.countDocuments();

    if (count < minCount) {
      const toInsert = minCount - count;

      await collection.insertMany(Array.from({ length: toInsert }, () => ({ created: new Date() })));
    }
  };

  /**
   * Simulates a long-running query by splitting delay across many documents.
   * MongoDB kills server-side JS after a few seconds; so we use a short delay per document
   * (e.g. 2s) and ensure enough documents so total time ≈ delayMs. Query stays "running" on server.
   *
   * @param options.queryLabel - string injected into the $where (and console.log'd); use it to find this query in RTA/logs
   * @returns Resolved array of documents
   */
  simulateLongRunningQuery = async (
    options: {
      chunkMs?: number;
      collectionName?: string;
      dbName?: string;
      delayMs?: number;
      queryLabel?: string;
    } = {},
  ) => {
    const {
      chunkMs = 5_000,
      collectionName = 'test',
      dbName = 'admin',
      delayMs = 10_000,
      queryLabel = 'rta-simulated-query',
    } = options;
    const numDocs = Math.max(1, Math.ceil(delayMs / chunkMs));

    await this.ensureCollectionHasDocuments(collectionName, dbName, numDocs);

    const collection = this.client.db(dbName).collection(collectionName);
    const escapedLabel = queryLabel.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const whereFn = [
      'function() {',
      `  var __rtaLabel = "${escapedLabel}";`,
      `  var end = new Date().getTime() + ${chunkMs};`,
      '  while (new Date().getTime() < end) {}',
      '  return true;',
      '}',
    ].join(' ');

    return collection.find({ $where: whereFn }).maxTimeMS(delayMs).toArray();
  };
}
