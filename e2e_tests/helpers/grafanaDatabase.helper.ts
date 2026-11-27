import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { APIRequestContext, expect } from '@playwright/test';
import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';

const { shellQuote } = CliHelper;

export const grafanaExited = 'exited: grafana';
export const supervisordLog = '/srv/logs/supervisord.log';
export const supervisordStarted = 'supervisord started';

/**
 * Grafana's database inside a PMM Server container, and the logs that show how Grafana reached it.
 * /srv/logs stays on the volume, so a log read after a restart or an upgrade covers only the current start.
 */
export default class GrafanaDatabaseHelper {
  constructor(private readonly cliHelper: CliHelper) {}

  /** Connects to the grafana database as the grafana role over TCP, the way Grafana does. */
  connectAsGrafana = (container: string, password: string) =>
    this.cliHelper.execSilent(
      `docker exec -e PGPASSWORD=${shellQuote(password)} ${container} psql -h 127.0.0.1 -U grafana -d grafana -Atc 'select 1'`,
    );

  /**
   * Container output, where the entrypoint and the PostgreSQL migration log. Each line starts with its time in
   * fixed-width RFC 3339, so times of two lines compare as text.
   */
  containerOutput = (container: string): string =>
    this.cliHelper.execSilent(`docker logs --timestamps ${container} 2>&1`).assertSuccess().stdout;

  /** Grafana exits since supervisord last started; fails when the log has no start, so 0 cannot come from an empty file. */
  countGrafanaExits = (container: string): number => {
    expect(
      this.countInContainer(container, supervisordLog, supervisordStarted),
      `${container} must have logged a supervisord start`,
    ).toBeGreaterThan(0);

    return this.countInContainer(container, supervisordLog, grafanaExited, supervisordStarted);
  };

  countInContainer = (container: string, file: string, pattern: string, startPattern?: string): number =>
    Number(
      this.cliHelper
        .execSilent(
          `docker exec ${container} ${GrafanaDatabaseHelper.countLines(file, pattern, startPattern)}`,
        )
        .assertSuccess()
        .stdout.trim(),
    );

  /**
   * A shell command printing how many lines of `file` match the extended regex `pattern`, counting only after the
   * last line that matches `startPattern` when one is given.
   */
  static countLines = (file: string, pattern: string, startPattern?: string): string =>
    `awk -v pattern=${shellQuote(pattern)} -v start=${shellQuote(startPattern ?? '')} 'start != "" && $0 ~ start { n = 0 } $0 ~ pattern { n++ } END { print n + 0 }' ${file}`;

  /** Statements recorded by pg_stat_statements in the built-in PostgreSQL whose text contains `text`. */
  countStatementsContaining = (container: string, text: string): number =>
    Number(
      this.queryAsPostgres(
        container,
        `select count(*) from pg_stat_statements where strpos(query, '${text}') > 0`,
      ),
    );

  /**
   * Lines of grafana.log written since the container last started that match the extended regex `pattern`. Grafana
   * prints its database errors without a time, so every line after the first one timed since the start counts.
   */
  grafanaLogSinceStart = (container: string, pattern: string): string[] => {
    const startedAt = this.cliHelper
      .execSilent(`docker inspect -f '{{.State.StartedAt}}' ${container}`)
      .assertSuccess()
      .stdout.trim()
      .slice(0, 19);

    return this.cliHelper
      .execSilent(
        `docker exec ${container} awk -v since=${startedAt} -v pattern=${shellQuote(pattern)} 'match($0, / t=[0-9TZ:.-]+/) && substr($0, RSTART + 3, 19) >= since { on = 1 } on && $0 ~ pattern' /srv/logs/grafana.log`,
      )
      .assertSuccess()
      .getStdOutLines();
  };

  queryAsPostgres = (container: string, sql: string): string =>
    this.cliHelper
      .execSilent(`docker exec ${container} psql -U postgres -d postgres -Atc ${shellQuote(sql)}`)
      .assertSuccess()
      .stdout.trim();

  /** Letters and digits only, so the value needs no quoting in SQL or in a shell. */
  static randomPassword = (): string =>
    randomBytes(48)
      .toString('base64')
      .replaceAll(/[^A-Za-z0-9]/g, '')
      .slice(0, 24);

  /**
   * Records a role password in pg_stat_statements unless utility tracking is off for it, the way a leaked one would be,
   * so a search for a secret that finds nothing is known to search where a leak would be.
   */
  recordMarkerPassword = (container: string): string => {
    const marker = `marker${GrafanaDatabaseHelper.randomPassword()}`;

    this.queryAsPostgres(container, `create role pmm_qa_marker password '${marker}'`);
    this.queryAsPostgres(container, 'drop role pmm_qa_marker');

    return marker;
  };

  removeServer = (container: string, volume: string) => {
    this.cliHelper.removeContainer(container);
    this.cliHelper.execSilent(`docker volume rm --force ${volume}`).assertSuccess();
  };

  /** The image ships its admin user as admin/admin; tests reach Grafana's API with ADMIN_PASSWORD. */
  setAdminPassword = (container: string) => {
    const password = process.env.ADMIN_PASSWORD || 'admin';

    if (password === 'admin') return;

    this.cliHelper
      .execSilent(`docker exec ${container} change-admin-password ${shellQuote(password)}`)
      .assertSuccess();
  };

  /** Stops PostgreSQL cleanly before removing the container, as an upgrade on the same volume needs. */
  stopServer = (container: string) => {
    this.cliHelper.execSilent(`docker stop --time 60 ${container}`).assertSuccess();
    this.cliHelper.removeContainer(container);
  };

  /** Grafana answers its health check only once it reaches its database. */
  waitForGrafanaDatabase = async (request: APIRequestContext, timeout = Timeouts.FIVE_MINUTES) => {
    await expect(async () => {
      const response = await request.get('graph/api/health');

      expect(response.status()).toEqual(200);
      expect(((await response.json()) as { database?: string }).database).toEqual('ok');
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout });
  };

  /** Writes a Grafana database password file the way an operator would mount it: owned by PMM's user, read-only. */
  writePasswordFile = (path: string, content: string) => {
    writeFileSync(path, content);
    this.cliHelper.execSilent(`sudo chown 1000:1000 ${path} && sudo chmod 0400 ${path}`).assertSuccess();
  };
}
