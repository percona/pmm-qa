import CliHelper from '@helpers/cli.helper';
import DockerHelper from '@helpers/docker.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

export default class PostgresqlHelper {
  constructor(
    private readonly cliHelper: CliHelper,
    private readonly dockerHelper: DockerHelper,
  ) {}

  // bool_and is NULL with no matching connection, so 't' cannot come back with no agent connected.
  allConnectionsUseTls = (container: string, user: string) =>
    this.cliHelper
      .execSilent(
        `docker exec ${container} psql -U postgres -tAc "SELECT bool_and(s.ssl) FROM pg_stat_ssl s JOIN pg_stat_activity a USING (pid) WHERE a.usename = '${user}'"`,
      )
      .assertSuccess()
      .stdout.trim();

  createDatabaseIfMissing = (container: string, name: string) => {
    if (this.query(container, `SELECT count(*) FROM pg_database WHERE datname = '${name}';`) === '0') {
      this.query(container, `CREATE DATABASE ${name};`);
    }
  };

  getSetting = (container: string, name: string) =>
    this.queryRows<{ reset_val: string; setting: string }>(
      container,
      `SELECT setting, reset_val FROM pg_settings WHERE name = '${name}'`,
    )[0];

  loadFile = (container: string, file: string, database?: string) =>
    this.cliHelper
      .execute(
        `docker exec -i ${container} psql -U postgres${database ? ` -d ${database}` : ''} -v ON_ERROR_STOP=1 < ${file}`,
      )
      .assertSuccess();

  pgbench = (container: string, args: string) =>
    this.cliHelper.execute(`docker exec ${container} pgbench ${args}`).assertSuccess();

  query = (container: string, query: string) =>
    this.cliHelper
      .execute(`docker exec ${container} psql -U postgres -tAc ${CliHelper.shellQuote(query)}`)
      .assertSuccess()
      .stdout.trim();

  queryRows = <T>(container: string, query: string) =>
    JSON.parse(this.query(container, `SELECT coalesce(json_agg(t), '[]') FROM (${query}) t;`)) as T[];

  setPgStatMonitorBucketTime = (container: string, seconds: number) => {
    this.query(container, `ALTER SYSTEM SET pg_stat_monitor.pgsm_bucket_time = ${seconds};`);
    this.cliHelper.execute(`docker exec ${container} service postgresql restart`).assertSuccess();
  };

  setPgStatStatementsMax = (container: string, max: number) => {
    this.query(container, `ALTER SYSTEM SET pg_stat_statements.max = ${max};`);
    this.cliHelper.execute(`docker exec ${container} service postgresql restart`).assertSuccess();
  };

  // The entrypoint's init server listens on the socket only, so a TCP answer means the final server is up.
  startWithoutDefaultDatabase = async (
    container: string,
    { database, password, username }: { database: string; password: string; username: string },
  ) => {
    const psql = `docker exec -e PGPASSWORD='${password}' ${container} psql -h 127.0.0.1 -U ${username} -d ${database}`;

    this.cliHelper.removeContainer(container);
    this.dockerHelper.startContainer(
      container,
      `-e POSTGRES_PASSWORD='${password}' -e POSTGRES_USER=${username} -e POSTGRES_DB=${database} perconalab/percona-distribution-postgresql:15`,
    );
    await expect
      .poll(() => this.cliHelper.execSilent(`${psql} -tAc 'SELECT 1'`).stdout.trim(), {
        message: `PostgreSQL in ${container} accepts TCP connections`,
        timeout: Timeouts.TWO_MINUTES,
      })
      .toBe('1');
    this.cliHelper
      .execute(`${psql} -v ON_ERROR_STOP=1 -c 'DROP DATABASE postgres WITH (FORCE)'`)
      .assertSuccess();
  };
}
