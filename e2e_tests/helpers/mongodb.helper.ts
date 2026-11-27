import { Document, MongoClient } from 'mongodb';
import { expect } from '@playwright/test';
import CliHelper from '@helpers/cli.helper';
import { Timeouts } from './timeouts';

const evalAsPbm = (replicaSet: string, members: string[], js: string) =>
  new CliHelper()
    .execute(
      `docker exec ${members[0]} mongo "mongodb://pbm:pbmpass@${members.map((member) => `${member}:27017`).join(',')}/?replicaSet=${replicaSet}&authSource=admin" --quiet --eval '${js}'`,
    )
    .assertSuccess();

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

  addUser = async (username: string, password: string, roles: Document[]) =>
    this.client.db('admin').command({ createUser: username, pwd: password, roles });

  createBulkCollections = async (dbName: string, collectionNames: string[]) => {
    const db = this.client.db(dbName);
    const existing = (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name);

    for (const collectionName of collectionNames) {
      if (existing.includes(collectionName)) await db.dropCollection(collectionName);

      await (await db.createCollection(collectionName)).insertOne({ a: `${dbName}-${collectionName}` });
    }
  };

  createIndexStats = async (dbName: string, collectionName: string) => {
    const collection = this.client.db(dbName).collection(collectionName);

    await collection.insertOne({ queried_field_qa: 'seed' });

    const unusedIndex = await collection.createIndex({ unused_field_qa: 1 });
    const usedIndex = await collection.createIndex({ queried_field_qa: 1 });

    await collection.find({ queried_field_qa: 'seed' }).hint(usedIndex).toArray();

    return { unusedIndex, usedIndex };
  };

  /**
   * Makes one replica set member a hidden, priority 0 member that applies the oplog delaySeconds late.
   *
   * @param   replicaSet    replica set name
   * @param   members       containers running its mongod members on port 27017
   * @param   memberIndex   index of the member in rs.conf().members
   * @param   delaySeconds  secondaryDelaySecs to set
   * @returns the delayed member's host name
   */
  delayReplicaSetMember = (
    replicaSet: string,
    members: string[],
    memberIndex: number,
    delaySeconds: number,
  ) =>
    evalAsPbm(
      replicaSet,
      members,
      `const c = rs.conf(), m = c.members[${memberIndex}]; m.secondaryDelaySecs = ${delaySeconds};` +
        ' m.priority = 0; m.hidden = true; rs.reconfig(c); print(m.host.split(":")[0]);',
    ).stdout.trim();

  dropDatabase = async (dbName: string) => this.client.db(dbName).dropDatabase();

  dropUser = async (username: string) => this.client.db('admin').command({ dropUser: username });

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

  getCollection = (dbName: string, collectionName: string) =>
    this.client.db(dbName).collection(collectionName);

  /**
   * A field of the newest backup record in admin.pbmBackups, or "none" when there is no backup.
   *
   * @param   container   a PSMDB container whose mongod runs on port 27017
   * @param   field       pbmBackups document field to read, e.g. status or name
   */
  getLatestPbmBackupField = (container: string, field: string) =>
    new CliHelper()
      .execute(
        `docker exec ${container} mongo "mongodb://root:root@localhost:27017/?authSource=admin&directConnection=true" --quiet --eval 'const backup = db.getSiblingDB("admin").pbmBackups.find().sort({ start_ts: -1 }).limit(1).toArray()[0]; backup ? backup.${field} : "none"'`,
      )
      .assertSuccess()
      .stdout.trim();

  /**
   * Errors that `pbm status` reports for each data-bearing PBM agent that is not OK, by host.
   *
   * @param   container   a PSMDB container with the pbm CLI configured
   */
  getPbmAgentErrors = (container: string): Record<string, string[]> => {
    const { cluster } = JSON.parse(
      new CliHelper().execute(`docker exec ${container} pbm status -s cluster -o json`).assertSuccess()
        .stdout,
    ) as { cluster: { nodes: { errors?: string[]; host: string; ok: boolean; role: string }[] }[] };

    return Object.fromEntries(
      cluster
        .flatMap(({ nodes }) => nodes)
        .filter(({ ok, role }) => role !== 'A' && !ok)
        .map(({ errors, host }) => [host, errors ?? []]),
    );
  };

  getReplicaSetMemberStates = async () =>
    ((await this.client.db('admin').command({ replSetGetStatus: 1 })).members as { stateStr: string }[]).map(
      ({ stateStr }) => stateStr,
    );

  /**
   * Undoes delayReplicaSetMember: every priority 0 data-bearing member gets back the priority 1, no delay
   * and visibility pmm-framework starts it with. Safe when no member was delayed.
   *
   * @param   replicaSet   replica set name
   * @param   members      containers running its mongod members on port 27017
   */
  resetDelayedReplicaSetMembers = (replicaSet: string, members: string[]) =>
    evalAsPbm(
      replicaSet,
      members,
      'const c = rs.conf(), delayed = c.members.filter((m) => !m.arbiterOnly && m.priority === 0);' +
        ' delayed.forEach((m) => { m.secondaryDelaySecs = 0; m.priority = 1; m.hidden = false; });' +
        ' if (delayed.length > 0) rs.reconfig(c);',
    );

  /**
   * Puts back the users and roles saveUsersAndRoles copied that are now missing, then drops the copy.
   * Stopping the primary while PBM swaps users and roles leaves only the pbm user PBM connects as
   * (swapUsers in pbm/restore/logical.go), so this runs as that user.
   *
   * @param   replicaSet   replica set name
   * @param   members      containers running its mongod members on port 27017
   */
  restoreUsersAndRoles = (replicaSet: string, members: string[]) =>
    evalAsPbm(
      replicaSet,
      members,
      'const admin = db.getSiblingDB("admin"), copy = db.getSiblingDB("pmm_qa_auth");' +
        ' for (const name of ["roles", "users"]) copy.getCollection(name).find().forEach((doc) => {' +
        ' const live = admin.getCollection("system." + name); if (!live.findOne({ _id: doc._id })) live.insertOne(doc); });' +
        ' copy.dropDatabase();',
    );

  /**
   * Copies admin.system.users and admin.system.roles into the pmm_qa_auth database. Take the copy after
   * the backup a restore will use, so the restore does not drop it.
   *
   * @param   replicaSet   replica set name
   * @param   members      containers running its mongod members on port 27017
   */
  saveUsersAndRoles = (replicaSet: string, members: string[]) =>
    evalAsPbm(
      replicaSet,
      members,
      'const admin = db.getSiblingDB("admin"), copy = db.getSiblingDB("pmm_qa_auth"); copy.dropDatabase();' +
        ' for (const name of ["roles", "users"]) copy.getCollection(name).insertMany(admin.getCollection("system." + name).find().toArray());',
    );

  /**
   * Starts or stops crond in the pbm-external container of EXTERNAL_PBM=true, whose job takes a logical backup
   * every 15 minutes. Stopping also waits until PBM runs no operation.
   *
   * @param   pbmUri   replica set URI the external PBM connects with
   * @param   action   whether to start or stop crond
   */
  setExternalPbmCron = async (pbmUri: string, action: 'start' | 'stop') => {
    const cli = new CliHelper();

    cli.execute(`docker exec pbm-external systemctl ${action} crond`).assertSuccess();

    if (action === 'start') return;

    const runningOperation = () => {
      const { stdout } = cli
        .execute(`docker exec -e PBM_MONGODB_URI='${pbmUri}' pbm-external pbm status -s running -o json`)
        .assertSuccess();

      return (JSON.parse(stdout) as { running?: { type?: string } }).running?.type;
    };

    // Stopping crond leaves a backup it has just started running, and PBM refuses any other operation until that one ends.
    await expect
      .poll(runningOperation, {
        intervals: [Timeouts.THREE_SECONDS],
        message: 'operation PBM is running',
        timeout: Timeouts.TWO_MINUTES,
      })
      .toBeUndefined();
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

  /**
   * Wait until the newest backup record in admin.pbmBackups has a status, and return the last status seen.
   * One mongo shell polls every 100 ms: a status can last less than the time it takes to start a shell for each poll.
   *
   * @param   container   a PSMDB container whose mongod runs on port 27017
   * @param   status      pbmBackups status to wait for, e.g. running
   * @param   timeout     ms to wait before giving up
   */
  waitForLatestPbmBackupStatus = (container: string, status: string, timeout: number) =>
    new CliHelper()
      .execute(
        `docker exec ${container} mongo "mongodb://root:root@localhost:27017/?authSource=admin&directConnection=true" --quiet --eval 'const deadline = Date.now() + ${timeout}; let status = "none"; while (Date.now() < deadline) { const backup = db.getSiblingDB("admin").pbmBackups.find().sort({ start_ts: -1 }).limit(1).toArray()[0]; status = backup ? backup.status : "none"; if (status === "${status}") break; sleep(100); } status'`,
      )
      .assertSuccess()
      .stdout.trim();
}
