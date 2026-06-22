import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';

pmmTest.describe('PMM Tests to verify external clickhouse', () => {
  const baseUrl = `https://127.0.0.1:449`;
  const dockerContainerName = 'pmm-server-external-clickhouse';
  const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';

  pmmTest.describe.configure({ retries: 0 });

  pmmTest.beforeAll(async ({ cliHelper }) => {
    cliHelper.execSilent(
      `docker run -d
        --name pmm-clickhouse
        --network pmm-qa
        -e CLICKHOUSE_DB=pmm
        -e CLICKHOUSE_USER=pmm
        -e CLICKHOUSE_PASSWORD=pmm-clickhouse-pass
        -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1
        -v pmm-clickhouse-data:/var/lib/clickhouse
        --ulimit nofile=262144:262144
        clickhouse/clickhouse-server:latest`,
    );
    cliHelper.execSilent(
      `docker run --detach --restart always --network="pmm-qa"
        -e PMM_CLICKHOUSE_ADDR=pmm-clickhouse:9000
        -e PMM_CLICKHOUSE_DATABASE=pmm
        -e PMM_CLICKHOUSE_USER=pmm
        -e PMM_CLICKHOUSE_PASSWORD=pmm-clickhouse-pass
        -e PMM_DISABLE_BUILTIN_CLICKHOUSE=1
        -e PMM_ENABLE_TELEMETRY=0
        --publish 449:8443
        --name ${dockerContainerName}
        ${dockerVersion}`,
    );
  });

  pmmTest.afterEach(async ({ cliHelper }) => {
    cliHelper.execSilent(`docker stop ${dockerContainerName}`);
    cliHelper.execSilent(`docker rm -f ${dockerContainerName}`);
  });

  pmmTest(
    'PMM-T2239 - Verify that metrics are not collected from internal ClickHouse when external ClickHouse is available @docker-configuration',
    async ({ api, cliHelper }) => {
      pmmTest.use({ baseURL: baseUrl });
      await api.serverApi.waitForReady();

      const logs = cliHelper.execSilent(
        `docker exec ${dockerContainerName} cat /srv/logs/victoriametrics.log | grep clickhouse`,
      );

      expect(logs.stdout, `Stdout for clickhouse logs should be empty but is: ${logs.stdout}`).toHaveLength(
        0,
      );
      expect(logs.stderr, `Stderr for clickhouse logs should be empty but is: ${logs.stderr}`).toHaveLength(
        0,
      );
    },
  );
});
