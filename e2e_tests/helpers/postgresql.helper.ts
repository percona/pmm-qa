import CliHelper from '@helpers/cli.helper';

export default class PostgresqlHelper {
  constructor(private readonly cliHelper: CliHelper) {}

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

  query = (container: string, query: string, user = 'postgres') =>
    this.cliHelper
      .execute(`docker exec ${container} psql -U ${user} -tAc ${CliHelper.shellQuote(query)}`)
      .assertSuccess()
      .stdout.trim();

  queryRows = <T>(container: string, query: string, user = 'postgres') =>
    JSON.parse(this.query(container, `SELECT coalesce(json_agg(t), '[]') FROM (${query}) t;`, user)) as T[];

  setPgStatMonitorBucketTime = (container: string, seconds: number) => {
    this.query(container, `ALTER SYSTEM SET pg_stat_monitor.pgsm_bucket_time = ${seconds};`);
    this.cliHelper.execute(`docker exec ${container} service postgresql restart`).assertSuccess();
  };

  setPgStatStatementsMax = (container: string, max: number) => {
    this.query(container, `ALTER SYSTEM SET pg_stat_statements.max = ${max};`);
    this.cliHelper.execute(`docker exec ${container} service postgresql restart`).assertSuccess();
  };
}
