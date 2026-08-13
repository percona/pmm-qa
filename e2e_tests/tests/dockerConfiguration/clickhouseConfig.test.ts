import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
const configurations = [
  {
    command: `docker run --detach --restart always --network="pmm-qa" -e PMM_CLICKHOUSE_CONFIG=default -e PMM_ENABLE_TELEMETRY=0 --publish 83:8080 --publish 446:8443 --name pmm-server-default-clickhouse-config ${dockerVersion}`,
    configName: 'default-config',
    containerName: 'pmm-server-default-clickhouse-config',
    port: 446,
  },
  {
    command: `docker run --detach --restart always --network="pmm-qa" -e PMM_CLICKHOUSE_CONFIG=low-memory -e PMM_ENABLE_TELEMETRY=0 --publish 84:8080 --publish 447:8443 --name pmm-server-low-memory-clickhouse-config ${dockerVersion}`,
    configName: 'low-memory-config',
    containerName: 'pmm-server-low-memory-clickhouse-config',
    port: 447,
  },
  {
    command: `docker run --detach --restart always --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 --publish 83:8080 --publish 448:8443 --name pmm-server-no-flag-clickhouse-config ${dockerVersion}`,
    configName: 'default-config',
    containerName: 'pmm-server-no-flag-clickhouse-config',
    port: 448,
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

        const startupLog = cliHelper.execSilent(
          `docker exec ${configuration.containerName} grep -m1 "Processing configuration file" /srv/logs/clickhouse-server.log`,
        );
        const loadedConfig = startupLog.stdout.match(/Processing configuration file '([^']+)'/)?.[1] ?? '';

        expect(
          loadedConfig,
          `ClickHouse reported no configuration file in /srv/logs/clickhouse-server.log: ${startupLog.stdout}`,
        ).not.toBe('');

        // ClickHouse is started with the fixed /etc/clickhouse-server/config.xml name, a symlink
        // PMM points at the config PMM_CLICKHOUSE_CONFIG selects; builds before PMM-15309 pass the
        // selected config directly. Resolving the reported path covers both.
        const resolvedConfig = cliHelper.execSilent(
          `docker exec ${configuration.containerName} readlink -f ${loadedConfig}`,
        );

        expect(
          resolvedConfig.stdout.trim(),
          `Config name should be: ${configuration.configName} but actual value is: ${resolvedConfig.stdout}`,
        ).toBe(`/etc/clickhouse-server/${configuration.configName}.xml`);
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
