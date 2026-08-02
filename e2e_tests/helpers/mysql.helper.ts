import mysql, { Pool } from 'mysql2/promise';
import { Timeouts } from './timeouts';

interface MySqlConfig {
  host?: string;
  port: number;
  username: string;
  password: string;
  database?: string;
}

export default class MySQLHelper {
  private pool: Pool;

  constructor(config: MySqlConfig) {
    this.pool = mysql.createPool({
      // Each long-running query occupies a connection for its whole duration,
      // so allow several to run concurrently for tests that need multiple rows.
      connectionLimit: 10,
      connectTimeout: Timeouts.THIRTY_SECONDS,
      database: config.database,
      host: config.host || '127.0.0.1',
      password: config.password,
      port: config.port,
      user: config.username,
    });
  }

  close = async () => await this.pool.end();

  runQuery = async (sql: string) => await this.pool.query(sql);

  /**
   * Simulates a long-running query visible in sys.x$processlist (and therefore in RTA).
   * SLEEP() keeps the statement in the processlist for the whole delay while consuming
   * nothing; the label is embedded as a string literal so the RTA query text can be
   * filtered by it (comments could be stripped by intermediaries, literals cannot).
   *
   * @param options.queryLabel - string selected by the query; use it to find this query in RTA
   * @returns Resolves when the statement finishes
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

    return this.pool.query(`SELECT '${escapedLabel}', SLEEP(${delaySeconds})`);
  };
}
