import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

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
      `docker run --detach --restart always --network="pmm-qa" -e PMM_CLICKHOUSE_ADDR=pmm-clickhouse:9000 -e PMM_CLICKHOUSE_DATABASE=pmm -e PMM_CLICKHOUSE_USER=pmm -e PMM_CLICKHOUSE_PASSWORD=pmm-clickhouse-pass -e PMM_DISABLE_BUILTIN_CLICKHOUSE=1 -e PMM_ENABLE_TELEMETRY=0 --publish 83:8080 --publish 449:8443 --name ${dockerContainerName} ${dockerVersion}`,
    );
    console.log(cliHelper.execSilent('docker ps'));
  });

  pmmTest(
    'PMM-T9997 - Verify that ClickHouse configuration can be controlled using environment variables @docker-configuration',
    async ({ api, cliHelper, page }) => {
      await page.waitForTimeout(Timeouts.TWENTY_SECONDS);

      const logs = cliHelper.execSilent(
        `docker exec ${dockerContainerName} cat /srv/logs/victoriametrics.log | grep clickhouse`,
      );

      console.log('Logs are:');
      console.log(logs);

      const baseUrl = `https://127.0.0.1:449`;

      await api.serverApi.waitForReady(baseUrl);


      expect(logs.stdout, 'victoriametrics should be configured against the external ClickHouse').toContain(
        'clickhouse',
      );
    },
  );
});
