import CliHelper from '@helpers/cli.helper';
import ExecReturn from '@interfaces/execReturn';

export interface PgQueryOptions {
  container: string;
  database?: string;
}

/**
 * Runs SQL against a PostgreSQL instance inside a docker container via `psql`.
 *
 * The CodeceptJS suite talked to Postgres through a `pg` client on the host.
 * The Playwright suite has no database driver, so queries are executed with
 * `docker exec ... psql`. Statements are base64 encoded before being piped in,
 * which sidesteps all shell quoting of the (often quote heavy) SQL.
 */
export default class PgsqlHelper {
  private cliHelper = new CliHelper();

  // Truncates the ClickHouse metrics table that backs QAN.
  cleanupClickhouse = (): ExecReturn =>
    this.cliHelper
      .execSilent(
        'docker exec pmm-server clickhouse-client --database pmm --password clickhouse --query "TRUNCATE TABLE metrics"',
      )
      .assertSuccess();

  // Executes one or more statements, returning the raw {@link ExecReturn}.
  exec = (sql: string, options: PgQueryOptions): ExecReturn => {
    const b64 = Buffer.from(sql).toString('base64');

    return this.cliHelper.execSilent(
      `docker exec ${options.container} bash -c "echo ${b64} | base64 -d | psql -U postgres -d ${this.database(options)} -X"`,
    );
  };

  /**
   * Runs a SELECT and returns its rows as typed objects.
   * The query is wrapped in `json_agg` so the result comes back as a single
   * JSON line, avoiding fragile column splitting.
   */
  queryRows = <T = Record<string, unknown>>(sql: string, options: PgQueryOptions): T[] => {
    const wrapped = `SELECT coalesce(json_agg(t), '[]'::json) FROM (${sql.trim().replace(/;\s*$/, '')}) t;`;
    const b64 = Buffer.from(wrapped).toString('base64');
    const output = this.cliHelper
      .execSilent(
        `docker exec ${options.container} bash -c "echo ${b64} | base64 -d | psql -U postgres -d ${this.database(options)} -tAX"`,
      )
      .assertSuccess()
      .stdout.trim();

    return JSON.parse(output || '[]') as T[];
  };

  // Resets pg_stat_monitor counters for the target database.
  resetPgStatMonitor = (options: PgQueryOptions): ExecReturn =>
    this.exec('SELECT pg_stat_monitor_reset();', options).assertSuccess();

  // Runs a `.sql` file (host path) by piping it into `psql` inside the container.
  runSqlFile = (filePath: string, options: PgQueryOptions): ExecReturn =>
    this.cliHelper
      .execSilent(
        `docker exec -i ${options.container} psql -U postgres -d ${this.database(options)} -X < ${filePath}`,
      )
      .assertSuccess();

  private database = (options: PgQueryOptions): string => options.database ?? 'postgres';
}
