import { MongoClient } from 'mongodb';
import { Timeouts } from './timeouts';

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
      connectTimeoutMS: Timeouts.THIRTY_SECONDS,
      directConnection: true,
    });
  }

  createIndexStats = async (dbName: string, collectionName: string) => {
    const collection = this.client.db(dbName).collection(collectionName);

    await collection.insertOne({ queried_field_qa: 'seed' });

    const unusedIndex = await collection.createIndex({ unused_field_qa: 1 });
    const usedIndex = await collection.createIndex({ queried_field_qa: 1 });

    await collection.find({ queried_field_qa: 'seed' }).hint(usedIndex).toArray();

    return { unusedIndex, usedIndex };
  };

  dropDatabase = async (dbName: string) => this.client.db(dbName).dropDatabase();

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
      chunkMs = Timeouts.FIVE_SECONDS,
      collectionName = 'test',
      dbName = 'admin',
      delayMs = Timeouts.TEN_SECONDS,
      queryLabel = 'rta-simulated-query',
    } = options;
    const numDocs = Math.max(1, Math.ceil(delayMs / chunkMs));

    try {
      await this.ensureCollectionHasDocuments(collectionName, dbName, numDocs);

      const collection = this.client.db(dbName).collection(collectionName);
      // The collection is shared by the whole suite and only ever grows, so the $where runs for
      // every document present, not just the numDocs this call asked for. Budget maxTimeMS from
      // the real count, otherwise the server kills the query it was told to keep running.
      const scannedDocs = Math.max(numDocs, await collection.countDocuments());
      const escapedLabel = queryLabel.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const whereFn = [
        'function() {',
        `  var __rtaLabel = "${escapedLabel}";`,
        `  var end = new Date().getTime() + ${chunkMs};`,
        '  while (new Date().getTime() < end) {}',
        '  return true;',
        '}',
      ].join(' ');

      return await collection
        .find({ $where: whereFn })
        .maxTimeMS(scannedDocs * chunkMs * 3)
        .toArray();
    } catch (error) {
      // Callers start these queries fire-and-forget, so an escaping rejection from any of these
      // steps would land on whichever test runs by then, not the one that started the query.
      console.log(`simulateLongRunningQuery("${queryLabel}") ended early: ${String(error)}`);

      return [];
    }
  };
}
