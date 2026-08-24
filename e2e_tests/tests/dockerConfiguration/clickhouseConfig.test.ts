import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
const configDir = '/etc/clickhouse-server';
const configurations = [
  {
    command: `docker run --detach --restart always --network="pmm-qa" -e PMM_CLICKHOUSE_CONFIG=default -e PMM_ENABLE_TELEMETRY=0 --publish 83:8080 --publish 446:8443 --name pmm-server-default-clickhouse-config ${dockerVersion}`,
    containerName: 'pmm-server-default-clickhouse-config',
    port: 446,
    profile: 'default',
  },
  {
    command: `docker run --detach --restart always --network="pmm-qa" -e PMM_CLICKHOUSE_CONFIG=low-memory -e PMM_ENABLE_TELEMETRY=0 --publish 84:8080 --publish 447:8443 --name pmm-server-low-memory-clickhouse-config ${dockerVersion}`,
    containerName: 'pmm-server-low-memory-clickhouse-config',
    port: 447,
    profile: 'low-memory',
  },
  {
    command: `docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 --publish 83:8080 --publish 448:8443 --name pmm-server-no-flag-clickhouse-config ${dockerVersion}`,
    containerName: 'pmm-server-no-flag-clickhouse-config',
    port: 448,
    profile: 'default',
  },
];

for (const configuration of configurations) {
  pmmTest.describe('PMM Tests to verify clickhouse configuration file', () => {
    const baseUrl = `https://127.0.0.1:${configuration.port}/`;

    pmmTest.use({ baseURL: baseUrl });

    pmmTest(
      `PMM-T2237 - Verify that ClickHouse configuration can be controlled using environment variables, for config ${configuration.containerName} @docker-configuration`,
      async ({ api, cliHelper }) => {
        cliHelper.execSilent(configuration.command);
        await api.serverApi.waitForReady();

        // PMM points the fixed config.xml and users.xml names at the files of the selected
        // configuration, so the configuration in use is read from those links. clickhouse-server is
        // always handed the fixed names and logs them verbatim, so its log no longer names the
        // configuration. readlink also exits non-zero when a link has been replaced by a regular
        // file, which is the state in which PMM_CLICKHOUSE_CONFIG is silently ignored.
        const configLink = cliHelper
          .execSilent(`docker exec ${configuration.containerName} readlink ${configDir}/config.xml`)
          .assertSuccess();

        expect(
          configLink.stdout.trim(),
          `config.xml should point at the ${configuration.profile} ClickHouse configuration`,
        ).toEqual(`${configDir}/${configuration.profile}-config.xml`);

        const usersLink = cliHelper
          .execSilent(`docker exec ${configuration.containerName} readlink ${configDir}/users.xml`)
          .assertSuccess();

        expect(
          usersLink.stdout.trim(),
          `users.xml should point at the ${configuration.profile} ClickHouse configuration`,
        ).toEqual(`${configDir}/${configuration.profile}-users.xml`);
      },
    );
  });

  pmmTest.afterEach(async ({ cliHelper }) => {
    cliHelper.execSilent(`docker stop ${configurations[0].containerName} || true`);
    cliHelper.execSilent(`docker rm -f ${configurations[0].containerName}  || true`);
    cliHelper.execSilent(`docker stop ${configurations[1].containerName} || true`);
    cliHelper.execSilent(`docker rm -f ${configurations[1].containerName}  || true`);
    cliHelper.execSilent(`docker stop ${configurations[2].containerName} || true`);
    cliHelper.execSilent(`docker rm -f ${configurations[2].containerName}  || true`);
  });
}
