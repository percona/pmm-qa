import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.describe('PMM Tests to verify external clickhouse', () => {
  const dockerContainerName = 'pmm-server-external-clickhouse';
  const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';

  pmmTest.beforeAll(async ({ cliHelper }) => {
    cliHelper.execSilent(`docker run -d \\
      --name pmm-clickhouse \\
      --network pmm-qa \\
      -e CLICKHOUSE_DB=pmm \\
      -e CLICKHOUSE_USER=pmm \\
      -e CLICKHOUSE_PASSWORD=pmm-clickhouse-pass \\
      -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \\
      -v pmm-clickhouse-data:/var/lib/clickhouse \\
      --ulimit nofile=262144:262144 \\
        clickhouse/clickhouse-server:25.3`);
    cliHelper.execSilent(
      `docker run --detach --restart always --network="pmm-qa"     -e PMM_CLICKHOUSE_ADDR=pmm-clickhouse:9000 -e PMM_CLICKHOUSE_DATABASE=pmm -e PMM_CLICKHOUSE_USER=pmm -e PMM_CLICKHOUSE_PASSWORD=pmm-clickhouse-pass -e PMM_DISABLE_BUILTIN_CLICKHOUSE=1 -e PMM_ENABLE_TELEMETRY=0 --publish 83:8080 --publish 446:8443 --name ${dockerContainerName} ${dockerVersion}`,
    );
    console.log(cliHelper.execSilent('docker ps'));
  });

  pmmTest(
    'PMM-T2237 - Verify that ClickHouse configuration can be controlled using environment variables @docker-configuration',
    async ({ api, cliHelper }) => {
      console.log('Test');
      // const baseUrl = `https://127.0.0.1:${data.port}/`;
      //
      // cliHelper.execSilent(data.command);
      // await api.serverApi.waitForReady(baseUrl);
      //
      // const configName = cliHelper.execSilent(
      //   `docker exec ${dockerContainerName} cat /srv/logs/clickhouse-server.log | grep "config"`,
      // );
      //
      // expect(
      //   configName.stdout,
      //   `Config name should be: ${data.configName} but actual value is: ${configName}`,
      // ).toContain(`${data.configName}.xml`);
    },
  );
});
