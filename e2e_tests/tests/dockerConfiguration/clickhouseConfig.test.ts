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
      `PMM-T2237 - Verify that ClickHouse configuration can be controlled using environment variables, for config ${configuration.configName} @docker-configuration`,
      async ({ api, cliHelper }) => {
        cliHelper.execSilent(configuration.command);
        await api.serverApi.waitForReady();

        const configName = cliHelper.execSilent(
          `docker exec ${configuration.containerName} cat /srv/logs/clickhouse-server.log | grep "config"`,
        );

        expect(
          configName.stdout,
          `Config name should be: ${configuration.configName} but actual value is: ${configName}`,
        ).toContain(`${configuration.configName}.xml`);
      },
    );
  });
}

pmmTest.afterAll(async ({ cliHelper }) => {
  cliHelper.execSilent(`docker stop ${configurations[0].containerName} || true`);
  cliHelper.execSilent(`docker rm -f ${configurations[0].containerName}  || true`);
  cliHelper.execSilent(`docker stop ${configurations[1].containerName} || true`);
  cliHelper.execSilent(`docker rm -f ${configurations[1].containerName}  || true`);
  cliHelper.execSilent(`docker stop ${configurations[2].containerName} || true`);
  cliHelper.execSilent(`docker rm -f ${configurations[2].containerName}  || true`);
});
