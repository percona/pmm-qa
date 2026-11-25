import Api from '@api/api';
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
    const connection = await this.openConnection();

    if (!connection) {
      throw new Error('MySQLHelper is closed');
    }

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
    const holder = await this.openConnection();
    const waiter = await this.openConnection();

    if (!holder || !waiter) {
      throw new Error('MySQLHelper is closed');
    }

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
    const connection = await this.openConnection();

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

const cliHelper = new CliHelper();
const remoteMySqlPassword = 'rta-QA-mysql-1';
// The data directory is on tmpfs: initializing several servers at once on disk takes minutes.
const remoteMySqlArgs = `--network pmm-qa --tmpfs /var/lib/mysql:mode=1777 --env MYSQL_ROOT_PASSWORD=${remoteMySqlPassword}`;
const remoteMySqls: { db?: MySQLHelper; name: string }[] = [];

/**
 * Starts each server as a Docker container named after its key and adds it as a remote MySQL service.
 * PMM Server's own agent monitors it by name over the pmm-qa network; the test reaches it on a published port.
 * Every container starts before any request is in flight: a docker run pulling its image blocks the test process.
 */
export const addRemoteMySqls = async (api: Api, servers: Record<string, string>) => {
  const serviceNames = Object.keys(servers);

  await api.inventoryApi.removeNodesByName(serviceNames);

  for (const [serviceName, dockerArgs] of Object.entries(servers)) {
    cliHelper.removeContainer(serviceName);
    remoteMySqls.push({ name: serviceName });
    cliHelper
      .execute(
        `docker run --detach --quiet --name ${serviceName} --publish 127.0.0.1::3306 ${remoteMySqlArgs} ${dockerArgs}`,
        Timeouts.FIVE_MINUTES,
      )
      .assertSuccess();
  }

  return Promise.all(
    serviceNames.map(async (serviceName) => {
      const port = Number(
        cliHelper
          .execSilent(`docker port ${serviceName} 3306/tcp`)
          .assertSuccess()
          .stdout.trim()
          .split(':')
          .at(-1),
      );
      const db = new MySQLHelper({
        host: '127.0.0.1',
        password: remoteMySqlPassword,
        port,
        username: 'root',
      });
      const server = remoteMySqls.find(({ name }) => name === serviceName);

      if (server) server.db = db;

      // The image initializes on a server without networking, so TCP answers only once the real server is up.
      await expect(async () => {
        await db.query('SELECT 1');
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

      const { mysql } = await api.managementApi.addService({
        mysql: {
          add_node: { node_name: serviceName, node_type: 'NODE_TYPE_REMOTE_NODE' },
          address: serviceName,
          password: remoteMySqlPassword,
          pmm_agent_id: 'pmm-server',
          port: 3_306,
          qan_mysql_perfschema: true,
          service_name: serviceName,
          username: 'root',
        },
      });

      if (!mysql) throw new Error(`Adding ${serviceName} returned no MySQL service`);

      return { db, serviceId: mysql.service.service_id, serviceName };
    }),
  );
};

// Removes every server addRemoteMySqls started: its connections, its node with the service, and its container.
export const removeRemoteMySqls = async (api: Api) => {
  const servers = remoteMySqls.splice(0);

  for (const { db } of servers) await db?.close();

  await api.inventoryApi.removeNodesByName(servers.map(({ name }) => name));

  for (const { name } of servers) cliHelper.removeContainer(name);
};
