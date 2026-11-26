import CliHelper from '@helpers/cli.helper';
import { expect } from '@playwright/test';
import mysql, { Connection, ConnectionOptions, RowDataPacket } from 'mysql2/promise';
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

  /** A connection that close() kills, for statements that must run in one session. */
  connect = async () => {
    const connection = await mysql.createConnection(this.config);

    if (this.closed) {
      connection.destroy();

      throw new Error('MySQLHelper is closed');
    }

    this.openConnections.push(connection);

    return connection;
  };

  query = async (sql: string, values: unknown[] = []) => {
    const connection = await mysql.createConnection(this.config);

    try {
      const [rows] = await connection.query<RowDataPacket[]>(sql, values);

      return rows;
    } finally {
      await connection.end();
    }
  };

  /**
   * Holds row 1 of rta_qa.lock_time_target for lockMs while a labelled statement waits for it; the
   * statement then sleeps 30 seconds, so its lock time stays readable while it runs.
   */
  simulateLockTime = async (queryLabel: string, lockMs: number) => {
    const holder = await this.connect();
    const waiter = await this.connect();

    await holder.query('CREATE DATABASE IF NOT EXISTS rta_qa');
    await holder.query('CREATE TABLE IF NOT EXISTS rta_qa.lock_time_target (id INT PRIMARY KEY)');
    await holder.query('INSERT IGNORE INTO rta_qa.lock_time_target VALUES (1)');
    await holder.query('BEGIN');
    await holder.query('SELECT id FROM rta_qa.lock_time_target WHERE id = 1 FOR UPDATE');
    void waiter
      .query('SELECT ?, SLEEP(30) FROM rta_qa.lock_time_target WHERE id = 1 FOR UPDATE', [queryLabel])
      .catch(this.ignoreAfterClose);
    await new Promise((resolve) => setTimeout(resolve, lockMs));
    await holder.query('COMMIT');
  };

  /**
   * Runs `SELECT <queryLabel>, SLEEP(<delay>)[, <trailing value>...]` so the labelled statement stays
   * in the processlist. Resolves when it finishes or close() kills it.
   */
  simulateLongRunningQuery = async (
    options: { delayMs?: number; queryLabel?: string; trailingValues?: string[] } = {},
  ) => {
    const {
      delayMs = Timeouts.TEN_SECONDS,
      queryLabel = 'rta-simulated-query',
      trailingValues = [],
    } = options;
    const connection = await this.connect().catch(this.ignoreAfterClose);

    if (!connection) {
      return;
    }

    await connection
      .query(`SELECT ?, SLEEP(?)${', ?'.repeat(trailingValues.length)}`, [
        queryLabel,
        Math.max(1, Math.ceil(delayMs / 1_000)),
        ...trailingValues,
      ])
      .catch(this.ignoreAfterClose);
  };

  /**
   * Holds a row lock in an open transaction and starts a labelled statement that waits for it.
   * Returns the connection id of the lock holder.
   */
  simulateRowLockWait = async (queryLabel: string) => {
    const holder = await this.connect();
    const waiter = await this.connect();

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
}

const cliHelper = new CliHelper();

/**
 * Runs SETUP in the pmm-framework MariaDB CONTAINER, then restarts MariaDB under systemd and waits until it answers.
 * Performance Schema is read only at startup, so changing it needs the restart.
 */
export const restartMariaDb = async (container: string, setup: string) => {
  cliHelper.execute(`docker exec ${container} sh -c "${setup} && systemctl restart mariadb"`).assertSuccess();

  await expect(() => {
    cliHelper.execSilent(`docker exec ${container} mariadb-admin ping`).assertSuccess();
  }).toPass({ intervals: [Timeouts.ONE_SECOND], timeout: Timeouts.ONE_MINUTE });
};
