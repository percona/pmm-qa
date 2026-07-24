const mysql = require('mysql2');

const { I } = inject();

let c;

const execute = (query) => new Promise((resolve, reject) => {
  c.query(query, (error, results) => {
    if (error) {
      reject(error);
    } else {
      resolve(results);
    }
  });
});

/**
 * Percona Server MySQL DB interaction module.
 * Based on "codeceptjs-dbhelper" plugin.
 */
module.exports = {
  defaultConnection: {
    host: 'mysql',
    port: 3306,
    username: 'root',
    password: '^O6VrIoC1@9b',
  },

  connectToPS(connection = this.defaultConnection) {
    const {
      host, port, username, password,
    } = connection;

    c = mysql.createConnection({
      host,
      port,
      user: username,
      password,
      database: 'mysql',
    });
  },

  /**
   * async connection constructor for reconnections to mySQL inside the tests.
   * I.say() is mandatory in the constructor to fix the execution sequence.
   *
   * @param   connection        connection details object, see: {@link #defaultConnection}
   * @returns {Promise<void>}   should be called with await
   */
  async asyncConnectToPS(connection = this.defaultConnection) {
    const {
      host, port, username, password,
    } = connection;

    await I.say('Connecting to MySQL');
    c = mysql.createConnection({
      host,
      port,
      user: username,
      password,
      database: 'mysql',
    });
  },

  /**
   * I.say() is mandatory to fix the execution sequence.
   *
   * @returns {Promise<void>}   should be called with await
   */
  async disconnectFromPS() {
    c.destroy();
    await I.say('Disconnected from mySQL');
  },

  async dropUser(username = 'empty-user') {
    await execute(`DROP USER IF EXISTS "${username}"@"localhost"`);
  },

  async createUser(username = 'empty-user', password = '') {
    if (password) {
      await execute(`CREATE USER "${username}"@"localhost" IDENTIFIED BY '${password}'`);
    } else {
      await execute(`CREATE USER "${username}"@"localhost"`);
    }
  },

  async setUserPassword(username = 'empty-user', password = 'password') {
    await execute(`ALTER USER "${username}"@"localhost" IDENTIFIED BY '${password}'`);
  },

  async createTable(name, columns = 'id INT AUTO_INCREMENT PRIMARY KEY, user VARCHAR(20) NOT NULL') {
    await execute(`CREATE TABLE IF NOT EXISTS \`${name}\` (${columns}) ENGINE=INNODB`);
  },

  async deleteTable(name) {
    await execute(`DROP TABLE IF EXISTS ${name}`);
  },

  async isTableExists(name) {
    await I.say(`SHOW TABLES LIKE '${name}'`);

    return new Promise((resolve, reject) => {
      c.query(`SHOW TABLES LIKE '${name}'`, (error, results) => {
        if (error) {
          reject(error);
        } else {
          I.say(JSON.stringify(results, null, 2));
          resolve(results.length > 0);
        }
      });
    });
  },
};
