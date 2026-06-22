import pmmTest from '@fixtures/pmmTest';
import dataTest from '@fixtures/dataTest';
import { expect } from '@playwright/test';

pmmTest.describe('PMM Tests to verify clickhouse configuration file', () => {
  const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
  const configuration = [
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

  pmmTest.afterAll(async ({ cliHelper }) => {
    cliHelper.execSilent(`docker stop ${configuration[0].containerName} || true`);
    cliHelper.execSilent(`docker rm -f ${configuration[0].containerName}  || true`);
    cliHelper.execSilent(`docker stop ${configuration[1].containerName} || true`);
    cliHelper.execSilent(`docker rm -f ${configuration[1].containerName}  || true`);
    cliHelper.execSilent(`docker stop ${configuration[2].containerName} || true`);
    cliHelper.execSilent(`docker rm -f ${configuration[2].containerName}  || true`);
  });

  dataTest(configuration).pmmTest(
    'PMM-T2237 - Verify that ClickHouse configuration can be controlled using environment variables',
    async (data, { api, cliHelper }) => {
      const baseUrl = `https://127.0.0.1:${data.port}/`;

      cliHelper.execSilent(data.command);
      await api.serverApi.waitForReady(baseUrl);

      const configName = cliHelper.execSilent(
        `docker exec ${data.containerName} cat /srv/logs/clickhouse-server.log | grep "config"`,
      );

      expect(
        configName.stdout,
        `Config name should be: ${data.configName} but actual value is: ${configName}`,
      ).toContain(`${data.configName}.xml`);
    },
  );
});
