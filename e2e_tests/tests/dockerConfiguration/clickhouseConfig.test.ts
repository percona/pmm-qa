import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';

type ClickHouseProfile = 'default' | 'low-memory';

interface ClickHouseSetting {
  changed: number;
  value: string;
}

const dockerVersion = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
const configDir = '/etc/clickhouse-server';
const serverSettings: Record<ClickHouseProfile, Record<string, string>> = {
  default: {
    concurrent_threads_soft_limit_num: '0',
    mark_cache_size: '5368709120',
    max_server_memory_usage_to_ram_ratio: '0.75',
    uncompressed_cache_size: '8589934592',
  },
  'low-memory': {
    concurrent_threads_soft_limit_num: '1',
    mark_cache_size: '536870912',
    max_server_memory_usage_to_ram_ratio: '0.5',
    uncompressed_cache_size: '2147483648',
  },
};
// default-users.xml leaves these at the ClickHouse defaults, which move between ClickHouse releases,
// so the default profile is checked for not overriding them rather than for their values.
const lowMemoryQuerySettings: Record<string, string> = {
  input_format_parallel_parsing: '0',
  max_block_size: '8192',
  max_download_threads: '1',
  output_format_parallel_formatting: '0',
};
const queryClickHouse = (cliHelper: CliHelper, containerName: string, query: string) =>
  cliHelper
    .execSilent(`docker exec ${containerName} clickhouse-client --password clickhouse --query "${query}"`)
    .assertSuccess();

const readSettings = (
  cliHelper: CliHelper,
  containerName: string,
  table: 'server_settings' | 'settings',
  names: string[],
): Record<string, ClickHouseSetting> => {
  const output = queryClickHouse(
    cliHelper,
    containerName,
    `SELECT name, value, changed FROM system.${table} WHERE name IN ('${names.join("', '")}') FORMAT JSONEachRow`,
  );

  return Object.fromEntries(
    output.getStdOutLines().map((line) => {
      const { changed, name, value } = JSON.parse(line) as ClickHouseSetting & { name: string };

      return [name, { changed, value }];
    }),
  );
};

const verifyClickHouseProfile = async (
  cliHelper: CliHelper,
  containerName: string,
  profile: ClickHouseProfile,
) => {
  await pmmTest.step(`Verify ClickHouse runs the ${profile} configuration`, async () => {
    // readlink also exits non-zero when a link has been replaced by a regular file, which is the
    // state in which PMM_CLICKHOUSE_CONFIG is silently ignored.
    for (const file of ['config', 'users']) {
      const link = cliHelper
        .execSilent(`docker exec ${containerName} readlink ${configDir}/${file}.xml`)
        .assertSuccess();

      expect(
        link.stdout.trim(),
        `${file}.xml should point at the ${profile} ClickHouse configuration`,
      ).toEqual(`${configDir}/${profile}-${file}.xml`);
    }

    const settings = readSettings(
      cliHelper,
      containerName,
      'server_settings',
      Object.keys(serverSettings[profile]),
    );

    expect(
      Object.fromEntries(Object.entries(settings).map(([name, setting]) => [name, setting.value])),
      `ClickHouse should run with the ${profile} server settings`,
    ).toEqual(serverSettings[profile]);

    const querySettings = readSettings(
      cliHelper,
      containerName,
      'settings',
      Object.keys(lowMemoryQuerySettings),
    );

    if (profile === 'low-memory') {
      expect(
        Object.fromEntries(Object.entries(querySettings).map(([name, setting]) => [name, setting.value])),
        'ClickHouse should run queries with the low-memory settings',
      ).toEqual(lowMemoryQuerySettings);
    } else {
      expect(
        Object.fromEntries(Object.entries(querySettings).map(([name, setting]) => [name, setting.changed])),
        'ClickHouse should run queries with its own default settings',
      ).toEqual(Object.fromEntries(Object.keys(lowMemoryQuerySettings).map((name) => [name, 0])));
    }
  });
};

const countQanRows = (cliHelper: CliHelper, containerName: string) =>
  Number(queryClickHouse(cliHelper, containerName, 'SELECT count() FROM pmm.metrics').stdout.trim());

// Stopping first lets PostgreSQL remove its postmaster.pid, which a container recreated on the same
// volume would otherwise trip over.
const removeContainer = (cliHelper: CliHelper, containerName: string) => {
  cliHelper.execSilent(`docker stop ${containerName} || true`);
  cliHelper.execSilent(`docker rm -f ${containerName} || true`);
};

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
      removeContainer(cliHelper, configuration.containerName);
    });

    pmmTest(
      `PMM-T2237 + PMM-T2359 - Verify that ClickHouse configuration can be controlled using environment variables and ClickHouse runs with its settings, for config ${configuration.containerName} @docker-configuration`,
      async ({ api, cliHelper }) => {
        cliHelper
          .execSilent(
            `docker run --detach --network="pmm-qa" ${configuration.env} -e PMM_ENABLE_TELEMETRY=0 --publish ${configuration.port}:8443 --name ${configuration.containerName} ${dockerVersion}`,
          )
          .assertSuccess();
        await api.serverApi.waitForReady(Timeouts.TWO_MINUTES);

        await verifyClickHouseProfile(cliHelper, configuration.containerName, configuration.profile);
      },
    );
  });
}

pmmTest.describe('PMM Tests to verify clickhouse low-memory configuration lifecycle', () => {
  const containerName = 'pmm-server-low-memory-clickhouse-lifecycle';
  const volumeName = 'pmm-server-low-memory-clickhouse-srv';
  const port = 450;
  const baseUrl = `https://127.0.0.1:${port}/`;
  const runCommand = (env: string) =>
    `docker run --detach --network="pmm-qa" ${env} -e PMM_ENABLE_INTERNAL_PG_QAN=1 -e PMM_ENABLE_TELEMETRY=0 --publish ${port}:8443 --volume ${volumeName}:/srv --name ${containerName} ${dockerVersion}`;

  pmmTest.use({ baseURL: baseUrl });

  pmmTest.afterEach(async ({ cliHelper }) => {
    removeContainer(cliHelper, containerName);
    cliHelper.execSilent(`docker volume rm ${volumeName} || true`);
  });

  pmmTest(
    'PMM-T2360 + PMM-T2361 - Verify Query Analytics shows data on the low-memory ClickHouse configuration, which survives a restart, and keeps it when switched back to default @docker-configuration',
    async ({ api, cliHelper, grafanaHelper, page, qanStoredMetrics, urlHelper }) => {
      cliHelper.execSilent(`docker volume create ${volumeName}`).assertSuccess();
      cliHelper.execSilent(runCommand('-e PMM_CLICKHOUSE_CONFIG=low-memory')).assertSuccess();
      await api.serverApi.waitForReady(Timeouts.TWO_MINUTES);
      await verifyClickHouseProfile(cliHelper, containerName, 'low-memory');

      await grafanaHelper.authorize('admin', 'admin', baseUrl);
      await page.goto(urlHelper.buildUrlWithParameters(baseUrl + qanStoredMetrics.url, { refresh: '10s' }));
      await qanStoredMetrics.waitForQanStoredMetricsToHaveData(Timeouts.FIVE_MINUTES);

      cliHelper.execSilent(`docker restart ${containerName}`).assertSuccess();
      await api.serverApi.waitForReady(Timeouts.TWO_MINUTES);
      await verifyClickHouseProfile(cliHelper, containerName, 'low-memory');

      const qanRows = countQanRows(cliHelper, containerName);

      expect(qanRows, 'Query Analytics data should be stored in ClickHouse').toBeGreaterThan(0);

      removeContainer(cliHelper, containerName);
      cliHelper.execSilent(runCommand('')).assertSuccess();
      await api.serverApi.waitForReady(Timeouts.TWO_MINUTES);
      await verifyClickHouseProfile(cliHelper, containerName, 'default');

      expect(
        countQanRows(cliHelper, containerName),
        'Query Analytics data stored with the low-memory configuration should be kept',
      ).toBeGreaterThanOrEqual(qanRows);
    },
  );
});

pmmTest.describe('PMM Tests to verify invalid clickhouse configuration', () => {
  const containerName = 'pmm-server-invalid-clickhouse-config';
  const invalidConfigurations = [
    {
      error: `invalid PMM_CLICKHOUSE_CONFIG=low: ${configDir}/low-config.xml not found; available configs: [default low-memory]`,
      value: 'low',
    },
    {
      error: 'invalid PMM_CLICKHOUSE_CONFIG=../default: must be a name, not a path',
      value: '../default',
    },
  ];

  pmmTest.afterEach(async ({ cliHelper }) => {
    removeContainer(cliHelper, containerName);
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

        const exitCode = cliHelper.execSilent(`timeout 120 docker wait ${containerName}`).assertSuccess();

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
  const port = 451;

  pmmTest.use({ baseURL: `https://127.0.0.1:${port}/` });

  pmmTest.afterEach(async ({ cliHelper }) => {
    removeContainer(cliHelper, containerName);
  });

  pmmTest(
    'PMM-T2363 - Verify the deprecated ClickHouse configuration switch script leaves the configuration unchanged @docker-configuration',
    async ({ api, cliHelper }) => {
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

      await verifyClickHouseProfile(cliHelper, containerName, 'default');
    },
  );
});
