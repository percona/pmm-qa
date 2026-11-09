import mysql, { Connection, ConnectionOptions } from 'mysql2/promise';
import { Timeouts } from './timeouts';

interface MySqlConfig {
  database?: string;
  host?: string;
  password: string;
  port: number;
  username: string;
}

export default class MySQLHelper {
  private closed = false;
  private config: ConnectionOptions;
  private openConnections: Connection[] = [];

  constructor(config: MySqlConfig) {
    this.config = {
      connectTimeout: Timeouts.THIRTY_SECONDS,
      database: config.database,
      host: config.host || '127.0.0.1',
      password: config.password,
      port: config.port,
      user: config.username,
    };
  }

  close = async () => {
    this.closed = true;

    if (this.openConnections.length === 0) {
      return;
    }

    // Killed on the server, so their statements do not linger in the next test's RTA view.
    const admin = await mysql.createConnection(this.config);

    for (const connection of this.openConnections) {
      await admin.query('KILL ?', [connection.threadId]).catch(() => undefined);
      connection.destroy();
    }

    this.openConnections = [];
    await admin.end();
  };

  /**
   * Runs `SELECT <queryLabel>, SLEEP(<delay>)` so the labelled statement stays in the processlist.
   * Resolves when it finishes or close() kills it.
   */
  simulateLongRunningQuery = async (options: { delayMs?: number; queryLabel?: string } = {}) => {
    const { delayMs = Timeouts.TEN_SECONDS, queryLabel = 'rta-simulated-query' } = options;
    const connection = await this.openConnection();

    if (!connection) {
      return;
    }

    await connection
      .query('SELECT ?, SLEEP(?)', [queryLabel, Math.max(1, Math.ceil(delayMs / 1_000))])
      .catch(this.ignoreAfterClose);
  };

  /**
   * Holds a row lock in an open transaction and starts a labelled statement that waits for it.
   * Returns the connection id of the lock holder.
   */
  simulateRowLockWait = async (queryLabel: string) => {
    const holder = await this.openConnection();
    const waiter = await this.openConnection();

    if (!holder || !waiter) {
      throw new Error('MySQLHelper is closed');
    }

    await holder.query('CREATE DATABASE IF NOT EXISTS rta_qa');
    await holder.query('CREATE TABLE IF NOT EXISTS rta_qa.lock_target (id INT PRIMARY KEY)');
    await holder.query('INSERT IGNORE INTO rta_qa.lock_target VALUES (1)');
    await holder.query('BEGIN');
    await holder.query('SELECT id FROM rta_qa.lock_target WHERE id = 1 FOR UPDATE');
    await waiter.query('SET SESSION innodb_lock_wait_timeout = 120');
    void waiter
      .query('SELECT ? AS label, id FROM rta_qa.lock_target WHERE id = 1 FOR UPDATE', [queryLabel])
      .catch(this.ignoreAfterClose);

    return holder.threadId;
  };

  private ignoreAfterClose = (error: unknown) => {
    if (!this.closed) {
      throw error;
    }
  };

  private openConnection = async () => {
    const connection = await mysql.createConnection(this.config);

    if (this.closed) {
      connection.destroy();

      return undefined;
    }

    this.openConnections.push(connection);

    return connection;
  };
}
