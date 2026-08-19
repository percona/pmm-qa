const { MongoClient } = require('mongodb');

class MongoDBHelper extends Helper {
  constructor(config) {
    super(config);
    this.host = config.host;
    this.port = config.port;
    this.username = config.username;
    this.password = config.password;
    this.url = `mongodb://${config.username}:${encodeURIComponent(config.password)}@${config.host}:${config.port}/?authSource=admin`;
    this.client = new MongoClient(this.url, {
      useNewUrlParser: true, connectTimeoutMS: 30000,
    });
  }

  /**
   * Connects to mongo shell. Takes options from the Helper config by default
   * if url param is passed - it is used for a connection
   * @returns {Promise<*>}
   * @param connection
   */
  async mongoConnect(connection) {
    const {
      host, port, username, password,
    } = connection;

    if (host) this.host = host;

    if (port) this.port = port;

    if (username) this.username = username;

    if (password) this.password = password;

    this.url = `mongodb://${this.username}:${encodeURIComponent(this.password)}@${this.host}:${this.port}/?authSource=admin`;
    this.client.s.url = this.url;

    this.client = new MongoClient(this.url, {
      useNewUrlParser: true, useUnifiedTopology: true, connectTimeoutMS: 30000,
    });

    return await this.client.connect();
  }

  async mongoConnectReplica(connection) {
    const {
      member1 = `${this.host}:27027`,
      member2 = `${this.host}:27028`,
      member3 = `${this.host}:27029`,
      replicaName = 'rs0',
      username,
      password,
    } = connection;

    if (username) this.username = username;

    if (password) this.password = password;

    this.url = `mongodb://${this.username}:${encodeURIComponent(this.password)}@${member1},${member2},${member3}/?authSource=admin&replicaSet=${replicaName}`;
    this.client.s.url = this.url;

    this.client = new MongoClient(this.url, {
      useNewUrlParser: true, useUnifiedTopology: true, connectTimeoutMS: 30000,
    });

    return await this.client.connect();
  }

  /**
   * Disconnects from mongo shell
   * @returns {Promise<void>}
   */
  async mongoDisconnect() {
    await this.client.close();
  }

  /**
   * Builds new parallel connection to MongoDB replica. And returns connected client.
   * Note! Please care to close connection whe it's no longer needed {@link MongoClient.close()}
   *
   * @param   parameters  Object credentials: { username: "string", password: "string" }
   * @return              {Promise<MongoClient>} connected instance of client
   */
  async getMongoReplicaClient(parameters) {
    const {
      member1 = `${this.host}:27027`,
      member2 = `${this.host}:27028`,
      member3 = `${this.host}:27029`,
      replicaName = 'rs0',
      username,
      password,
    } = parameters;
    const user = username || this.username;
    const pass = password || this.password;
    const url = `mongodb://${user}:${encodeURIComponent(pass)}@${member1},${member2},${member3}/?authSource=admin&replicaSet=${replicaName}`;
    const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true, connectTimeoutMS: 30000 });

    return await client.connect();
  }

  /**
   * Builds new parallel connection to MongoDB. And returns connected client.
   * Note! Please care to close connection when it's no longer needed {@link MongoClient.close()}
   *
   * @param   parameters  Object credentials: { username: "string", password: "string", port: "string" }
   * @return              {Promise<MongoClient>} connected instance of client
   */
  async getMongoClient(parameters) {
    const {
      port = '27017',
      username,
      password,
    } = parameters;
    const user = username || this.username;
    const pass = password || this.password;
    const url = `mongodb://${user}:${encodeURIComponent(pass)}@${this.host}:${port}/?authSource=admin`;
    const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true, connectTimeoutMS: 30000 });

    return await client.connect();
  }

  /**
   * Runs a command against the current database
   * read more here: https://docs.mongodb.com/manual/reference/command/
   * @example await I.mongoExecuteCommand({ getLastError: 1 })
   * @param cmdObj
   * @param db
   * @returns {Promise<*>}
   */
  async mongoExecuteCommand(cmdObj, db) {
    return await this.client.db(db).command(cmdObj);
  }

  /**
   * Runs an administrative command against the admin database
   * read more here: https://docs.mongodb.com/manual/reference/command/
   * @example await I.mongoExecuteAdminCommand({ listDatabases: 1 })
   * @param cmdObj
   * @returns {Promise<*>}
   */
  async mongoExecuteAdminCommand(cmdObj) {
    return await this.client.db().admin().command(cmdObj);
  }

  /**
   * Creates new user
   * @param username
   * @param password
   * @param rolesArr
   * @returns {Promise<unknown>}
   */
  async mongoAddUser(username, password, roles = [{ db: 'admin', role: 'userAdminAnyDatabase' }]) {
    return this.client.db().admin().addUser(username, password, { roles });
  }

  /**
   * Removes a user
   * @param username
   * @returns {Promise<*>}
   */
  async mongoRemoveUser(username) {
    return await this.client.db().admin().removeUser(username);
  }

  /**
   * Returns databases list
   * @returns {Promise<*>}
   */
  async mongoListDBs() {
    return await this.client.db().admin().listDatabases();
  }

  /**
   * Creates a collection in a database and returns collection object
   * @example
   * const col = await I.mongoCreateCollection('local', 'e2e');
   * await col.insertOne({ a: '111' });
   * await col.find().toArray()
   * @param dbName
   * @param collectionName
   * @returns {Promise<*>}
   */
  async mongoCreateCollection(dbName, collectionName) {
    return await this.client.db(dbName).createCollection(collectionName);
  }

  /**
   * Returns collection object for further use
   * @example
   * const col = await I.mongoGetCollection('local', 'e2e');
   * await col.insertOne({ a: '111' });
   * @param dbName
   * @param collectionName
   * @returns {Promise<Collection>}
   */
  async mongoGetCollection(dbName, collectionName) {
    return this.client.db(dbName).collection(collectionName);
  }

  /**
   * Deletes a collection in a database
   * @param dbName
   * @param collectionName
   * @returns {Promise<*>}
   */
  async mongoDropCollection(dbName, collectionName) {
    return await this.client.db(dbName).dropCollection(collectionName);
  }

  /**
   * Returns collections in a database
   * @param dbName
   * @returns {Promise<*>}
   */
  async mongoShowCollections(dbName) {
    const collections = await this.client.db(dbName).listCollections();

    return await collections.toArray();
  }

  /**
   * Drop collections if they already exist in the DB, use this for Data reset
   * @param dbname
   * @param col
   * @returns {Promise<void>}
   */
  async dropCollectionIfExist(dbname, col) {
    const collections = (await this.mongoShowCollections(dbname)).map((collection) => collection.name);

    if (collections.indexOf(col) !== -1) {
      await this.client.db(dbname).dropCollection(col);
    }
  }

  /**
   * Creates collections in Bulk in a database
   * @example
   * const col = await I.mongoCreateBulkCollection('local', 'e2e');
   * await col.insertOne({ a: '111' });
   * await col.find().toArray()
   * @param dbName
   * @param collectionNames, array of collection
   */
  async mongoCreateBulkCollections(dbName, collectionNames = []) {
    for (let i = 0; i < collectionNames.length; i++) {
      await this.dropCollectionIfExist(dbName, collectionNames[i]);

      const col = await this.client.db(dbName).createCollection(collectionNames[i]);

      await col.insertOne({ a: `${dbName}-${collectionNames[i]}` });
    }
  }
}

module.exports = MongoDBHelper;
