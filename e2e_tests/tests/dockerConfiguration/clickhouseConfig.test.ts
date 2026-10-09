import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { ClickHouseProfile, clickHouseConfigDir } from '@helpers/clickhouse.helper';
import { Timeouts } from '@helpers/timeouts';

const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
const configurations: { containerName: string; env: string; port: number; profile: ClickHouseProfile }[] = [
  {
    containerName: 'pmm-server-default-clickhouse-config',
    env: '-e PMM_CLICKHOUSE_CONFIG=default',
    port: 446,
    profile: 'default',
  },
  {
    containerName: 'pmm-server-low-memory-clickhouse-config',
    env: '-e PMM_CLICKHOUSE_CONFIG=low-memory',
    port: 447,
    profile: 'low-memory',
  },
  {
    containerName: 'pmm-server-no-flag-clickhouse-config',
    env: '',
    port: 448,
    profile: 'default',
  },
];

for (const configuration of configurations) {
  pmmTest.describe('PMM Tests to verify clickhouse configuration file', () => {
    pmmTest.use({ baseURL: `https://127.0.0.1:${configuration.port}/` });

    pmmTest.afterEach(async ({ cliHelper }) => {
      cliHelper.removeContainer(configuration.containerName);
    });

    pmmTest(
      `PMM-T2237 + PMM-T2359 - Verify that ClickHouse configuration can be controlled using environment variables and ClickHouse runs with its settings, for config ${configuration.containerName} @docker-configuration`,
      async ({ api, clickHouseHelper, cliHelper }) => {
        cliHelper
          .execSilent(
            `docker run --detach --network="pmm-qa" ${configuration.env} -e PMM_ENABLE_TELEMETRY=0 --publish ${configuration.port}:8443 --name ${configuration.containerName} ${dockerVersion}`,
          )
          .assertSuccess();
        await api.serverApi.waitForReady(Timeouts.TWO_MINUTES);

        await clickHouseHelper.verifyProfile(configuration.containerName, configuration.profile);
      },
    );
  });
}

pmmTest.describe('PMM Tests to verify clickhouse low-memory configuration lifecycle', () => {
  const containerName = 'pmm-server-low-memory-clickhouse-lifecycle';
  const volumeName = 'pmm-server-low-memory-clickhouse-srv';
  const port = 452;
  const baseUrl = `https://127.0.0.1:${port}/`;
  const runCommand = (env: string) =>
    `docker run --detach --network="pmm-qa" ${env} -e PMM_ENABLE_INTERNAL_PG_QAN=1 -e PMM_ENABLE_TELEMETRY=0 --publish ${port}:8443 --volume ${volumeName}:/srv --name ${containerName} ${dockerVersion}`;

  pmmTest.use({ baseURL: baseUrl });

  pmmTest.afterEach(async ({ cliHelper }) => {
    cliHelper.removeContainer(containerName);
    cliHelper.execSilent(`docker volume rm ${volumeName} || true`);
  });

  pmmTest(
    'PMM-T2360 + PMM-T2361 - Verify Query Analytics shows data on the low-memory ClickHouse configuration, which survives a restart, and keeps it when switched back to default @docker-configuration',
    async ({ api, clickHouseHelper, cliHelper, grafanaHelper, page, qanStoredMetrics, urlHelper }) => {
      cliHelper.execSilent(`docker volume create ${volumeName}`).assertSuccess();
      cliHelper.execSilent(runCommand('-e PMM_CLICKHOUSE_CONFIG=low-memory')).assertSuccess();
      await api.serverApi.waitForReady(Timeouts.TWO_MINUTES);
      await clickHouseHelper.verifyProfile(containerName, 'low-memory');

      await grafanaHelper.authorize('admin', 'admin', baseUrl);
      await page.goto(urlHelper.buildUrlWithParameters(baseUrl + qanStoredMetrics.url, { refresh: '10s' }));
      // The first pg_stat_statements bucket lands about a minute after readyz.
      await qanStoredMetrics.waitForQanStoredMetricsToHaveData(Timeouts.FIVE_MINUTES);

      cliHelper.execSilent(`docker restart ${containerName}`).assertSuccess();
      await api.serverApi.waitForReady(Timeouts.TWO_MINUTES);
      await clickHouseHelper.verifyProfile(containerName, 'low-memory');

      const qanRows = clickHouseHelper.countQanRows(containerName);

      expect(qanRows, 'Query Analytics data should survive the restart').toBeGreaterThan(0);

      cliHelper.removeContainer(containerName);
      cliHelper.execSilent(runCommand('')).assertSuccess();
      await api.serverApi.waitForReady(Timeouts.TWO_MINUTES);
      await clickHouseHelper.verifyProfile(containerName, 'default');

      expect(
        clickHouseHelper.countQanRows(containerName),
        'Query Analytics data stored with the low-memory configuration should be kept',
      ).toBeGreaterThanOrEqual(qanRows);
    },
  );
});

pmmTest.describe('PMM Tests to verify invalid clickhouse configuration', () => {
  const containerName = 'pmm-server-invalid-clickhouse-config';
  const invalidConfigurations = [
    {
      error: `invalid PMM_CLICKHOUSE_CONFIG=low: ${clickHouseConfigDir}/low-config.xml not found; available configs: [default low-memory]`,
      value: 'low',
    },
    {
      error: 'invalid PMM_CLICKHOUSE_CONFIG=../default: must be a name, not a path',
      value: '../default',
    },
  ];

  pmmTest.afterEach(async ({ cliHelper }) => {
    cliHelper.removeContainer(containerName);
  });

  for (const configuration of invalidConfigurations) {
    pmmTest(
      `PMM-T2362 - Verify PMM Server does not start with an unknown or path-like ClickHouse configuration name "${configuration.value}" @docker-configuration`,
      async ({ cliHelper }) => {
        cliHelper
          .execSilent(
            `docker run --detach --network="pmm-qa" -e PMM_CLICKHOUSE_CONFIG=${configuration.value} -e PMM_ENABLE_TELEMETRY=0 --name ${containerName} ${dockerVersion}`,
          )
          .assertSuccess();

        const exitCode = cliHelper
          .execSilent(`timeout ${Timeouts.TWO_MINUTES / Timeouts.ONE_SECOND} docker wait ${containerName}`)
          .assertSuccess();

        expect(exitCode.stdout.trim(), 'PMM Server container should exit with an error').toEqual('1');
        expect(
          cliHelper.execSilent(`docker logs ${containerName} 2>&1`).stdout,
          'PMM Server logs should name the invalid ClickHouse configuration',
        ).toContain(configuration.error);
      },
    );
  }
});

pmmTest.describe('PMM Tests to verify deprecated clickhouse configuration switch script', () => {
  const containerName = 'pmm-server-switch-script-clickhouse-config';
  const port = 453;

  pmmTest.use({ baseURL: `https://127.0.0.1:${port}/` });

  pmmTest.afterEach(async ({ cliHelper }) => {
    cliHelper.removeContainer(containerName);
  });

  pmmTest(
    'PMM-T2363 - Verify the deprecated ClickHouse configuration switch script leaves the configuration unchanged @docker-configuration',
    async ({ api, clickHouseHelper, cliHelper }) => {
      cliHelper
        .execSilent(
          `docker run --detach --network="pmm-qa" -e PMM_ENABLE_TELEMETRY=0 --publish ${port}:8443 --name ${containerName} ${dockerVersion}`,
        )
        .assertSuccess();
      await api.serverApi.waitForReady(Timeouts.TWO_MINUTES);

      const switchConfig = cliHelper.execSilent(
        `docker exec -u pmm ${containerName} /opt/switch-config.sh low`,
      );

      switchConfig.exitCodeEquals(1);
      expect(switchConfig.stderr, 'switch-config.sh should point at PMM_CLICKHOUSE_CONFIG').toContain(
        'Set PMM_CLICKHOUSE_CONFIG=default|low-memory',
      );

      await clickHouseHelper.verifyProfile(containerName, 'default');
    },
  );
});
