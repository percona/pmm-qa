import mysql, { Connection, Pool } from 'mysql2/promise';
import { Timeouts } from './timeouts';

interface MySqlConfig {
  host?: string;
  port: number;
  username: string;
  password: string;
  database?: string;
}

export default class MySQLHelper {
  private closed = false;
  private config: mysql.PoolOptions;
  // Connections running intentionally long queries; destroyed on close() so
  // fixture teardown does not wait for SLEEP() statements to finish.
  private longRunningConnections: Connection[] = [];
  private pool: Pool;

  constructor(config: MySqlConfig) {
    this.config = {
      connectTimeout: Timeouts.THIRTY_SECONDS,
      database: config.database,
      host: config.host || '127.0.0.1',
      password: config.password,
      port: config.port,
      user: config.username,
    };
    this.pool = mysql.createPool(this.config);
  }

  close = async () => {
    this.closed = true;

    // destroy() drops the socket immediately instead of draining, so teardown
    // is not blocked by long-running SLEEP() queries.
    for (const connection of this.longRunningConnections) {
      connection.destroy();
    }

    this.longRunningConnections = [];

    await this.pool.end();
  };

  runQuery = async (sql: string) => await this.pool.query(sql);

  /**
   * Simulates a long-running query visible in sys.x$processlist (and therefore in RTA).
   * SLEEP() keeps the statement in the processlist for the whole delay while consuming
   * nothing; the label is embedded as a string literal so the RTA query text can be
   * filtered by it (comments could be stripped by intermediaries, literals cannot).
   *
   * Runs on a dedicated connection that close() destroys, so tests do not have to
   * wait for the full delay. Errors caused by that teardown are suppressed; anything
   * else is rethrown so a query that could not run still fails the test.
   *
   * @param options.queryLabel - string selected by the query; use it to find this query in RTA
   * @returns Resolves when the statement finishes or the helper is closed
   */
  simulateLongRunningQuery = async (
    options: {
      delayMs?: number;
      queryLabel?: string;
    } = {},
  ) => {
    const { delayMs = Timeouts.TEN_SECONDS, queryLabel = 'rta-simulated-query' } = options;
    const escapedLabel = queryLabel.replace(/\\/g, '\\\\').replace(/'/g, "''");
    const delaySeconds = Math.max(1, Math.ceil(delayMs / 1_000));
    const connection = await mysql.createConnection(this.config);

    this.longRunningConnections.push(connection);

    try {
      return await connection.query(`SELECT '${escapedLabel}', SLEEP(${delaySeconds})`);
    } catch (error) {
      if (this.closed) {
        return null;
      }

      throw error;
    }
  };
}
