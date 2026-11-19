import os from 'node:os';
import path from 'node:path';
import { expect } from '@playwright/test';
import CliHelper from '@helpers/cli.helper';
import DockerHelper from '@helpers/docker.helper';
import { Timeouts } from '@helpers/timeouts';

const clientImage = process.env.CLIENT_DOCKER_VERSION || 'perconalab/pmm-client:3-dev-latest';
const mysqlImage = process.env.PS_IMAGE || 'percona/percona-server:8.4';
const mysqlContainer = 'ps-credentials-files';
const mysqlPassword = 'MysqlRoot-credentials1';
const clientContainer = 'pmm-client-credentials-files';
const clickHouseImage = process.env.CLICKHOUSE_IMAGE || 'clickhouse/clickhouse-server:latest';
// Every place a PMM Server process could read a credential from, without the container's own environment.
const leakSearchPaths = '/proc/[0-9]*/environ /etc/grafana /etc/supervisord.d /srv';
const searchedMarker = 'credentials-search-done';

export const externalClickHouse = {
  container: 'clickhouse-credentials-files',
  datasourceUser: 'grafana_ro',
  user: 'pmm',
  volume: 'clickhouse-credentials-files-data',
};
export const credentialsServer = {
  baseUrl: 'https://127.0.0.1:446/',
  container: 'pmm-server-credentials-files',
  port: 446,
  volume: 'pmm-server-credentials-files-data',
};
export const mysqlServiceName = 'ps-credentials-files-service';
export const resolvedSecretsDir = '/run/pmm/secrets';
export const secretsMount = '/etc/pmm/secrets';
export const secretsDir = path.join(os.tmpdir(), 'pmm-credentials-files');

export default class CredentialsFilesHelper {
  constructor(
    private readonly cliHelper: CliHelper,
    private readonly dockerHelper: DockerHelper,
  ) {}

  // Starts Percona Server, a PMM Client container registered to the server, adds MySQL with QAN and keeps
  // a query load running.
  addMySqlWithLoad = async (serverAddress: string, adminPassword: string) => {
    this.dockerHelper.startContainer(mysqlContainer, `-e MYSQL_ROOT_PASSWORD=${mysqlPassword} ${mysqlImage}`);
    await expect
      .poll(
        () =>
          this.cliHelper.execSilent(
            `docker exec ${mysqlContainer} mysql -uroot -p${mysqlPassword} -e "SELECT 1"`,
          ).code,
        { intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES },
      )
      .toBe(0);
    this.dockerHelper.startContainer(
      clientContainer,
      `-e PMM_AGENT_SETUP=1 -e PMM_AGENT_SETUP_FORCE=1 -e PMM_AGENT_SERVER_INSECURE_TLS=1
        -e PMM_AGENT_SERVER_ADDRESS=${serverAddress} -e PMM_AGENT_SERVER_USERNAME=admin
        -e PMM_AGENT_SERVER_PASSWORD=${adminPassword} -e PMM_AGENT_CONFIG_FILE=config/pmm-agent.yaml
        -e PMM_AGENT_SETUP_NODE_NAME=${clientContainer} ${clientImage}`,
    );
    await expect
      .poll(() => this.cliHelper.execSilent(`docker exec ${clientContainer} pmm-admin status`).code, {
        intervals: [Timeouts.FIVE_SECONDS],
        timeout: Timeouts.TWO_MINUTES,
      })
      .toBe(0);
    this.cliHelper
      .execute(
        `docker exec ${clientContainer} pmm-admin add mysql --username=root --password=${mysqlPassword}
          --host=${mysqlContainer} --port=3306 --query-source=perfschema ${mysqlServiceName}`,
      )
      .assertSuccess();
    this.cliHelper
      .execSilent(
        `docker exec -d ${mysqlContainer} sh -c 'while true; do mysql -uroot -p${mysqlPassword}
          -e "SELECT SLEEP(0.2), COUNT(*) FROM information_schema.tables" >/dev/null 2>&1; sleep 1; done'`,
      )
      .assertSuccess();
  };

  // Returns the files under the search paths of the container that contain the value, each process environment
  // followed by the name of its process. The search runs with an empty environment, so it never reads the value
  // from its own environment.
  findLeaks = (value: string, container = credentialsServer.container, paths = leakSearchPaths) => {
    const search = this.cliHelper.execSilent(
      `docker exec ${container} env -i sh -c 'grep -rlF ${value} ${paths} | while read -r f; do
        case "$f" in /proc/*) echo "$f $(cat "\${f%/environ}/comm" 2>/dev/null)";; *) echo "$f";; esac;
        done; echo ${searchedMarker}'`,
    );

    expect(search.stdout, `The search for the value should have run in ${container}`).toContain(
      searchedMarker,
    );

    return search
      .getStdOutLines()
      .filter((line) => line !== searchedMarker && !/^\/proc\/(self|thread-self)\//.test(line));
  };

  // Returns the GF_SECURITY_* variables of the running Grafana process. The image has no pgrep.
  grafanaSecurityVariables = (container = credentialsServer.container) =>
    this.cliHelper
      .execSilent(
        `docker exec ${container} env -i sh -c 'for p in /proc/[0-9]*; do
          [ "$(cat $p/comm 2>/dev/null)" = grafana ] && tr "\\0" "\\n" <$p/environ; done | grep GF_SECURITY'`,
      )
      .getStdOutLines();

  listResolvedSecrets = (container = credentialsServer.container) =>
    this.cliHelper
      .execSilent(`docker exec ${container} ls ${resolvedSecretsDir}`)
      .assertSuccess()
      .getStdOutLines();

  readLog = (container = credentialsServer.container) =>
    this.cliHelper.execSilent(`docker logs ${container} 2>&1`).stdout;

  removeAll = () => {
    for (const container of [
      clientContainer,
      mysqlContainer,
      credentialsServer.container,
      externalClickHouse.container,
    ]) {
      this.cliHelper.removeContainer(container);
    }

    this.cliHelper
      .execSilent(`docker volume rm -f ${credentialsServer.volume} ${externalClickHouse.volume}`)
      .assertSuccess();
    this.cliHelper.execSilent(`sudo rm -rf ${secretsDir}`).assertSuccess();
  };

  // Starts ClickHouse with a user for PMM Server and a read-only user for the Query Analytics data source.
  startClickHouse = async (password: string, datasourcePassword: string) => {
    this.dockerHelper.startContainer(
      externalClickHouse.container,
      `-e CLICKHOUSE_DB=pmm -e CLICKHOUSE_USER=${externalClickHouse.user} -e CLICKHOUSE_PASSWORD=${password}
        -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 -v ${externalClickHouse.volume}:/var/lib/clickhouse
        --ulimit nofile=262144:262144 ${clickHouseImage}`,
    );

    const clickHouseQuery = (query: string) =>
      this.cliHelper.execSilent(
        `docker exec ${externalClickHouse.container} clickhouse-client --user ${externalClickHouse.user}
          --password ${password} --query "${query}"`,
      );

    await expect
      .poll(() => clickHouseQuery('SELECT 1').code, {
        intervals: [Timeouts.FIVE_SECONDS],
        timeout: Timeouts.ONE_MINUTE,
      })
      .toBe(0);
    clickHouseQuery(
      `CREATE USER IF NOT EXISTS ${externalClickHouse.datasourceUser} IDENTIFIED BY '${datasourcePassword}'`,
    ).assertSuccess();
    clickHouseQuery(`GRANT SELECT ON pmm.* TO ${externalClickHouse.datasourceUser}`).assertSuccess();
  };

  startPmmServer = async (
    args: string,
    image = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest',
  ) => {
    this.dockerHelper.startContainer(
      credentialsServer.container,
      `-p ${credentialsServer.port}:8443 -v ${credentialsServer.volume}:/srv -e PMM_ENABLE_TELEMETRY=0 ${args} ${image}`,
    );

    try {
      await this.dockerHelper.waitForHealthy(credentialsServer.container);
    } catch (error) {
      console.log(
        this.cliHelper.execSilent(`docker logs --tail 200 ${credentialsServer.container} 2>&1`).stdout,
      );
      console.log(
        this.cliHelper.execSilent(
          `docker exec ${credentialsServer.container} sh -c 'supervisorctl status; curl -s http://127.0.0.1:8080/v1/server/readyz; tail -40 /srv/logs/pmm-managed.log; grep -i "lvl=eror\\|level=error" /srv/logs/grafana.log | tail -20'`,
        ).stdout,
      );
      console.log(
        this.cliHelper.execSilent(`docker inspect -f '{{json .State.Health}}' ${credentialsServer.container}`)
          .stdout,
      );

      throw error;
    }
  };

  // Stops the server before removing it, so PostgreSQL does not find a stale postmaster.pid on the same volume.
  stopPmmServer = () => this.cliHelper.removeContainer(credentialsServer.container);

  // Writes each credential to its own file, owned by UID 1000 with mode 0400, as PMM Server reads them.
  writeSecrets = (secrets: Record<string, string>, dir = secretsDir) => {
    this.cliHelper.execSilent(`sudo rm -rf ${dir} && mkdir -p ${dir}`).assertSuccess();

    for (const [name, value] of Object.entries(secrets)) {
      this.cliHelper.execSilent(`printf '%s' '${value}' > ${dir}/${name}`).assertSuccess();
    }

    this.cliHelper
      .execSilent(`sudo chown -R 1000:1000 ${dir} && sudo chmod 0400 ${dir}/* && sudo chmod 0500 ${dir}`)
      .assertSuccess();
  };
}
