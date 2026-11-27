import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { APIRequestContext, expect, Page } from '@playwright/test';
import Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
import CliHelper from '@helpers/cli.helper';
import DockerHelper from '@helpers/docker.helper';
import GrafanaDatabaseHelper, { supervisordLog, supervisordStarted } from '@helpers/grafanaDatabase.helper';
import GrafanaHelper from '@helpers/grafana.helper';
import { Timeouts } from '@helpers/timeouts';
import Dashboard from '@pages/dashboards/dashboards.page';
import UsersPage from '@pages/users.page';

const imageUnderTest = process.env.DOCKER_VERSION || 'perconalab/pmm-server:3-dev-latest';
const pmm391 = 'percona/pmm-server:3.9.1';
const pmm3100 = 'percona/pmm-server:3.10.0';
const container = 'pmm-server-grafana-db';
const port = 8_460;
const passwordFileMount = '/etc/pmm/gdb';
const externalPostgres = 'external-postgres';
const canary = { dashboard: 'pmm-15919-canary', panel: 'PMM-15919 canary panel', viewer: 'qa-viewer' };
const authenticationFailed = 'password authentication failed for user "grafana"';
const ensuringGrafanaDatabase = 'Ensuring grafana role and database';
const { randomPassword } = GrafanaDatabaseHelper;
const volumes = new Set<string>();
let passwordDir = '';
let externalPostgresStarted = false;

interface ServerFixtures {
  api: Api;
  dockerHelper: DockerHelper;
}

interface CanaryFixtures {
  api: Api;
  dashboard: Dashboard;
  grafanaDatabaseHelper: GrafanaDatabaseHelper;
  grafanaHelper: GrafanaHelper;
  page: Page;
  request: APIRequestContext;
  usersPage: UsersPage;
}

const newVolume = (label: string) => {
  const volume = `grafana-db-${label}-${Date.now()}`;

  volumes.add(volume);

  return volume;
};

const startServer = async (
  { api, dockerHelper }: ServerFixtures,
  image: string,
  volume: string,
  args = '',
  waitForReady = true,
) => {
  dockerHelper.startContainer(
    container,
    `--publish ${port}:8443 --volume ${volume}:/srv -e PMM_ENABLE_TELEMETRY=0 ${args} ${image}`,
  );

  if (waitForReady) await api.serverApi.waitForReady(Timeouts.FIVE_MINUTES);
};

const passwordFileArgs = (file: string) =>
  `--volume ${passwordDir}/${file}:${passwordFileMount}:ro -e PMM_GRAFANA_DB_PASSWORD_FILE=${passwordFileMount}`;

const writePasswordFiles = (grafanaDatabaseHelper: GrafanaDatabaseHelper, files: Record<string, string>) => {
  passwordDir = mkdtempSync(join(tmpdir(), 'grafana-db-'));

  for (const [file, content] of Object.entries(files)) {
    grafanaDatabaseHelper.writePasswordFile(`${passwordDir}/${file}`, content);
  }
};

/** Creates the dashboard and the Viewer user that a restart or an upgrade must keep; returns the dashboard URL. */
const seedCanary = async ({ api, grafanaDatabaseHelper, grafanaHelper }: CanaryFixtures) => {
  grafanaDatabaseHelper.setAdminPassword(container);
  await grafanaHelper.authorize();

  const { url } = await api.grafanaApi.createDashboard(canary.dashboard, canary.panel);

  await grafanaHelper.createUser(canary.viewer, `${randomPassword()}-Aa1`);

  return url;
};

const verifyCanaryData = async (
  { dashboard, grafanaHelper, page, usersPage }: CanaryFixtures,
  url: string,
) => {
  await grafanaHelper.authorize();
  await page.goto(url);
  await expect(dashboard.elements.panelName).toHaveText(canary.panel, { timeout: Timeouts.ONE_MINUTE });
  await page.goto(usersPage.url);
  await expect(usersPage.builders.userRow(canary.viewer)).toBeVisible({ timeout: Timeouts.ONE_MINUTE });
};

const verifyConnects = (grafanaDatabaseHelper: GrafanaDatabaseHelper, password: string, label: string) => {
  const connection = grafanaDatabaseHelper.connectAsGrafana(container, password);

  expect(connection.stderr, `The grafana role must log in with ${label}`).toEqual('');
  expect(connection.stdout.trim(), `The grafana role must log in with ${label}`).toEqual('1');
};

const verifyRefused = (grafanaDatabaseHelper: GrafanaDatabaseHelper, password: string, label: string) => {
  const connection = grafanaDatabaseHelper.connectAsGrafana(container, password);

  expect(connection.code, `The grafana role must not log in with ${label}`).not.toEqual(0);
  expect(connection.stderr).toContain(authenticationFailed);
};

const verifyNoGrafanaExit = (grafanaDatabaseHelper: GrafanaDatabaseHelper) => {
  expect(
    grafanaDatabaseHelper.countGrafanaExits(container),
    'Grafana exits since supervisord started',
  ).toEqual(0);
};

/** Searches pg_stat_statements for the password only after a marker password shows that a leak would be recorded. */
const verifyPasswordNotRecorded = (grafanaDatabaseHelper: GrafanaDatabaseHelper, password: string) => {
  const marker = grafanaDatabaseHelper.recordMarkerPassword(container);

  expect(
    grafanaDatabaseHelper.countStatementsContaining(container, marker),
    'pg_stat_statements must record a role password set with utility tracking on',
  ).toBeGreaterThan(0);
  expect(
    grafanaDatabaseHelper.countStatementsContaining(container, password),
    'Recorded statements containing the Grafana database password',
  ).toEqual(0);
};

/**
 * The precondition of the upgrade cases: a dashboard and a Viewer user on an older release, and with `password`,
 * Grafana started with GF_DATABASE_PASSWORD and the grafana role altered to it.
 */
const prepareOlderVolume = async (
  fixtures: CanaryFixtures & ServerFixtures & { cliHelper: CliHelper },
  image: string,
  volume: string,
  password?: string,
) => {
  const { api, cliHelper, grafanaDatabaseHelper, request } = fixtures;

  await startServer(
    fixtures,
    image,
    volume,
    password ? `-e GF_DATABASE_PASSWORD=${password}` : '',
    !password,
  );

  if (password) {
    await expect(() => {
      expect(
        grafanaDatabaseHelper.queryAsPostgres(
          container,
          "select count(*) from pg_roles where rolname = 'grafana'",
        ),
      ).toEqual('1');
    }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    cliHelper
      .execSilent(
        `docker exec -e PGOPTIONS='-c pg_stat_statements.track_utility=off' ${container} psql -U postgres -d postgres -c "alter role grafana password '${password}'"`,
      )
      .assertSuccess();
    cliHelper.execSilent(`docker exec ${container} supervisorctl restart grafana`).assertSuccess();
    await api.serverApi.waitForReady(Timeouts.FIVE_MINUTES);
  }

  await grafanaDatabaseHelper.waitForGrafanaDatabase(request);

  const url = await seedCanary(fixtures);

  grafanaDatabaseHelper.stopServer(container);

  return url;
};

pmmTest.describe('PMM Server creates and keeps Grafana database', () => {
  pmmTest.describe.configure({ mode: 'default' });
  pmmTest.use({ baseURL: `https://127.0.0.1:${port}/` });

  pmmTest.beforeEach(async ({ cliHelper }) => {
    cliHelper.execSilent('docker network create pmm-qa || true');
  });

  pmmTest.afterEach(async ({ cliHelper, externalPostgresHelper, grafanaDatabaseHelper }) => {
    cliHelper.removeContainer(container);

    for (const volume of volumes) grafanaDatabaseHelper.removeServer(container, volume);

    volumes.clear();

    if (passwordDir) cliHelper.execSilent(`sudo rm -rf ${passwordDir}`).assertSuccess();

    passwordDir = '';

    if (externalPostgresStarted) externalPostgresHelper.removeAll();

    externalPostgresStarted = false;
  });

  pmmTest(
    'PMM-T2915 - Verify Grafana starts on the first try on a fresh PMM Server @docker-configuration',
    async ({ api, dashboard, dockerHelper, grafanaDatabaseHelper, grafanaHelper, page }) => {
      await pmmTest.step('Start PMM 3.10.0 on an empty volume with one CPU', async () => {
        await startServer({ api, dockerHelper }, pmm3100, newVolume('t2915-control'), '--cpus=1');
      });

      await pmmTest.step('Verify PMM 3.10.0 logs Grafana exiting (bug reproduced)', async () => {
        await expect
          .poll(() => grafanaDatabaseHelper.countGrafanaExits(container), { timeout: Timeouts.ONE_MINUTE })
          .toBeGreaterThan(0);
        grafanaDatabaseHelper.stopServer(container);
      });

      for (const run of [1, 2, 3]) {
        await pmmTest.step(
          `Run ${run}: start the image under test on an empty volume with one CPU`,
          async () => {
            await startServer(
              { api, dockerHelper },
              imageUnderTest,
              newVolume(`t2915-run${run}`),
              '--cpus=1',
            );
          },
        );

        await pmmTest.step(`Run ${run}: verify Grafana started once, on an existing database`, async () => {
          verifyNoGrafanaExit(grafanaDatabaseHelper);
          expect(
            grafanaDatabaseHelper.grafanaLogSinceStart(container, '3D000|database "grafana" does not exist'),
            'Missing-database errors in grafana.log',
          ).toEqual([]);

          const output = grafanaDatabaseHelper.containerOutput(container).split('\n');
          const ensured = output.filter((line) => line.includes(ensuringGrafanaDatabase));
          const supervisordStart = output.find((line) => line.includes('supervisord started'));

          expect(ensured, 'The Grafana role and database step must run once').toHaveLength(1);
          expect(supervisordStart, 'The container output must show supervisord starting').toBeDefined();
          expect(
            ensured[0].split(' ')[0] < (supervisordStart ?? '').split(' ')[0],
            `"${ensured[0]}" must come before "${supervisordStart}"`,
          ).toBeTruthy();
        });

        await pmmTest.step(`Run ${run}: log in as Admin and open the Home dashboard`, async () => {
          await grafanaHelper.authorize('admin', 'admin');
          await page.goto(dashboard.home.url);
          await expect(dashboard.home.elements.homeDashboardLocator).toBeVisible({
            timeout: Timeouts.ONE_MINUTE,
          });
          grafanaDatabaseHelper.stopServer(container);
        });
      }
    },
  );

  pmmTest(
    'PMM-T2916 - Verify Grafana uses the Grafana database password supplied in a file on a fresh install @docker-configuration',
    async ({ api, dockerHelper, grafanaDatabaseHelper, grafanaHelper, page, searchDashboardsPage }) => {
      const passwordA = randomPassword();
      const passwordB = randomPassword();

      writePasswordFiles(grafanaDatabaseHelper, { 'gdb-a': `${passwordA}\n`, 'gdb-b': `  ${passwordB}\n\n` });

      await pmmTest.step('Start PMM Server with password file gdb-a on an empty volume', async () => {
        await startServer(
          { api, dockerHelper },
          imageUnderTest,
          newVolume('t2916-a'),
          passwordFileArgs('gdb-a'),
        );
        verifyNoGrafanaExit(grafanaDatabaseHelper);
      });

      await pmmTest.step(
        `Log in as Admin, save dashboard "${canary.dashboard}" and find it under Dashboards`,
        async () => {
          grafanaDatabaseHelper.setAdminPassword(container);
          await grafanaHelper.authorize();
          await api.grafanaApi.createDashboard(canary.dashboard, canary.panel);
          await page.goto(searchDashboardsPage.url);
          await expect(searchDashboardsPage.builders.dashboardRow(canary.dashboard)).toBeVisible({
            timeout: Timeouts.ONE_MINUTE,
          });
        },
      );

      await pmmTest.step('Verify the grafana role takes password A and refuses the default one', async () => {
        verifyConnects(grafanaDatabaseHelper, passwordA, 'password A');
        verifyRefused(grafanaDatabaseHelper, 'grafana', 'the default password');
      });

      await pmmTest.step('Verify no recorded statement contains password A', async () => {
        verifyPasswordNotRecorded(grafanaDatabaseHelper, passwordA);
      });

      await pmmTest.step('Start again on a new empty volume with password file gdb-b', async () => {
        grafanaDatabaseHelper.stopServer(container);
        await startServer(
          { api, dockerHelper },
          imageUnderTest,
          newVolume('t2916-b'),
          passwordFileArgs('gdb-b'),
        );
        verifyNoGrafanaExit(grafanaDatabaseHelper);
      });

      await pmmTest.step(
        'Verify the grafana role takes password B without its spaces and newlines',
        async () => {
          verifyConnects(grafanaDatabaseHelper, passwordB, 'password B trimmed');
        },
      );
    },
  );

  pmmTest(
    'PMM-T2917 - Verify restarting PMM Server keeps Grafana data and applies a changed Grafana database password @docker-configuration',
    async ({
      api,
      cliHelper,
      dashboard,
      dockerHelper,
      grafanaDatabaseHelper,
      grafanaHelper,
      page,
      request,
      usersPage,
    }) => {
      const fixtures = {
        api,
        dashboard,
        dockerHelper,
        grafanaDatabaseHelper,
        grafanaHelper,
        page,
        request,
        usersPage,
      };
      const passwordA = randomPassword();
      const passwordC = randomPassword();
      const volume = newVolume('t2917');

      writePasswordFiles(grafanaDatabaseHelper, { 'gdb-a': `${passwordA}\n`, 'gdb-c': `${passwordC}\n` });

      const url = await pmmTest.step(
        'Start PMM Server with password file gdb-a and seed Grafana data',
        async () => {
          await startServer(fixtures, imageUnderTest, volume, passwordFileArgs('gdb-a'));

          return await seedCanary(fixtures);
        },
      );

      await pmmTest.step('Restart the container and verify Grafana does not exit', async () => {
        cliHelper.execSilent(`docker restart ${container}`).assertSuccess();
        await api.serverApi.waitForReady(Timeouts.FIVE_MINUTES);
        expect(
          grafanaDatabaseHelper.countInContainer(container, supervisordLog, supervisordStarted),
          'supervisord must have started twice on the volume',
        ).toEqual(2);
        verifyNoGrafanaExit(grafanaDatabaseHelper);
      });

      await pmmTest.step(
        'Note "database system is starting up" errors in grafana.log since the restart',
        async () => {
          const startingUp = grafanaDatabaseHelper.grafanaLogSinceStart(container, '57P03|starting up');

          // The case notes these without failing on them: an earlier QA run saw one and put it outside this fix.
          pmmTest.info().annotations.push({
            description: `${startingUp.length} line(s) since the restart`,
            type: '57P03 in grafana.log',
          });
        },
      );

      await pmmTest.step('Verify the dashboard opens and qa-viewer is listed', async () => {
        await verifyCanaryData(fixtures, url);
      });

      await pmmTest.step('Recreate the container on the same volume and password file', async () => {
        grafanaDatabaseHelper.stopServer(container);
        await startServer(fixtures, imageUnderTest, volume, passwordFileArgs('gdb-a'));
        verifyNoGrafanaExit(grafanaDatabaseHelper);
        await verifyCanaryData(fixtures, url);
      });

      await pmmTest.step('Recreate the container on the same volume with password file gdb-c', async () => {
        grafanaDatabaseHelper.stopServer(container);
        await startServer(fixtures, imageUnderTest, volume, passwordFileArgs('gdb-c'));
        verifyNoGrafanaExit(grafanaDatabaseHelper);
      });

      await pmmTest.step('Verify the grafana role takes password C and refuses password A', async () => {
        verifyConnects(grafanaDatabaseHelper, passwordC, 'password C');
        verifyRefused(grafanaDatabaseHelper, passwordA, 'the replaced password A');
      });
    },
  );

  pmmTest(
    'PMM-T2918 - Verify upgrading from PMM 3.9 with a custom Grafana database password keeps Grafana up @docker-configuration',
    async ({
      api,
      cliHelper,
      dashboard,
      dockerHelper,
      grafanaDatabaseHelper,
      grafanaHelper,
      page,
      request,
      usersPage,
    }) => {
      const fixtures = {
        api,
        cliHelper,
        dashboard,
        dockerHelper,
        grafanaDatabaseHelper,
        grafanaHelper,
        page,
        request,
        usersPage,
      };
      const passwordD = randomPassword();
      const customPassword = `-e GF_DATABASE_PASSWORD=${passwordD}`;
      const controlVolume = newVolume('t2918-control');
      const customVolume = newVolume('t2918-custom');
      const defaultVolume = newVolume('t2918-default');

      pmmTest.setTimeout(Timeouts.THIRTY_MINUTES);

      const [customUrl, defaultUrl] = await pmmTest.step(
        'Prepare three PMM 3.9.1 volumes with Grafana data',
        async () => {
          await prepareOlderVolume(fixtures, pmm391, controlVolume, passwordD);

          return [
            await prepareOlderVolume(fixtures, pmm391, customVolume, passwordD),
            await prepareOlderVolume(fixtures, pmm391, defaultVolume),
          ];
        },
      );

      await pmmTest.step(
        'Upgrade the control volume to PMM 3.10.0 and verify Grafana is locked out (bug reproduced)',
        async () => {
          await startServer(fixtures, pmm3100, controlVolume, customPassword, false);
          await expect
            .poll(
              () =>
                grafanaDatabaseHelper.grafanaLogSinceStart(container, 'password authentication failed')
                  .length,
              {
                timeout: Timeouts.FIVE_MINUTES,
              },
            )
            .toBeGreaterThan(0);
          expect(
            (await request.get('graph/login')).status(),
            'The login page must not load while Grafana cannot reach its database',
          ).toBeGreaterThanOrEqual(500);
          grafanaDatabaseHelper.stopServer(container);
        },
      );

      await pmmTest.step('Upgrade the custom-password volume to the image under test', async () => {
        await startServer(fixtures, imageUnderTest, customVolume, customPassword);
        expect(grafanaDatabaseHelper.containerOutput(container)).toContain(
          'PostgreSQL 14 to 18 migration completed successfully.',
        );
      });

      await pmmTest.step('Verify Grafana neither exited nor failed to log in since the upgrade', async () => {
        verifyNoGrafanaExit(grafanaDatabaseHelper);
        expect(
          grafanaDatabaseHelper.grafanaLogSinceStart(container, 'password authentication failed'),
        ).toEqual([]);
      });

      await pmmTest.step('Verify the dashboard opens and qa-viewer is listed', async () => {
        await verifyCanaryData(fixtures, customUrl);
      });

      await pmmTest.step('Verify the grafana role takes password D and refuses the default one', async () => {
        verifyConnects(grafanaDatabaseHelper, passwordD, 'password D');
        verifyRefused(grafanaDatabaseHelper, 'grafana', 'the default password');
      });

      await pmmTest.step('Verify no recorded statement contains password D', async () => {
        verifyPasswordNotRecorded(grafanaDatabaseHelper, passwordD);
      });

      await pmmTest.step('Upgrade the default volume and verify Grafana and its data', async () => {
        grafanaDatabaseHelper.stopServer(container);
        await startServer(fixtures, imageUnderTest, defaultVolume);
        verifyNoGrafanaExit(grafanaDatabaseHelper);
        await verifyCanaryData(fixtures, defaultUrl);
      });
    },
  );

  pmmTest(
    "PMM-T2919 - Verify upgrading from PMM 3.10.0 keeps Grafana's database and password @docker-configuration",
    async ({
      api,
      cliHelper,
      dashboard,
      dockerHelper,
      grafanaDatabaseHelper,
      grafanaHelper,
      page,
      request,
      usersPage,
    }) => {
      const fixtures = {
        api,
        cliHelper,
        dashboard,
        dockerHelper,
        grafanaDatabaseHelper,
        grafanaHelper,
        page,
        request,
        usersPage,
      };
      const passwordE = randomPassword();
      const customVolume = newVolume('t2919-custom');
      const defaultVolume = newVolume('t2919-default');

      pmmTest.setTimeout(Timeouts.THIRTY_MINUTES);

      const [customUrl, defaultUrl] = await pmmTest.step(
        'Prepare two PMM 3.10.0 volumes with Grafana data',
        async () => [
          await prepareOlderVolume(fixtures, pmm3100, customVolume, passwordE),
          await prepareOlderVolume(fixtures, pmm3100, defaultVolume),
        ],
      );

      await pmmTest.step('Upgrade the custom-password volume to the image under test', async () => {
        await startServer(fixtures, imageUnderTest, customVolume, `-e GF_DATABASE_PASSWORD=${passwordE}`);
        verifyNoGrafanaExit(grafanaDatabaseHelper);
      });

      await pmmTest.step('Verify the dashboard opens and qa-viewer is listed', async () => {
        await verifyCanaryData(fixtures, customUrl);
      });

      await pmmTest.step('Verify the grafana role takes password E and refuses the default one', async () => {
        verifyConnects(grafanaDatabaseHelper, passwordE, 'password E');
        verifyRefused(grafanaDatabaseHelper, 'grafana', 'the default password');
      });

      await pmmTest.step('Upgrade the default volume and verify Grafana and its data', async () => {
        grafanaDatabaseHelper.stopServer(container);
        await startServer(fixtures, imageUnderTest, defaultVolume);
        verifyNoGrafanaExit(grafanaDatabaseHelper);
        await verifyCanaryData(fixtures, defaultUrl);
      });
    },
  );

  pmmTest(
    'PMM-T2920 - Verify PMM Server with an external Grafana database creates nothing for Grafana in its own PostgreSQL @docker-configuration',
    async ({
      api,
      cliHelper,
      dashboard,
      dockerHelper,
      externalPostgresHelper,
      grafanaDatabaseHelper,
      grafanaHelper,
      page,
    }) => {
      const passwordF = randomPassword();
      const externalDatabase = (sql: string) =>
        cliHelper
          .execSilent(
            `docker exec ${externalPostgres} psql -U postgres -d grafana_ext -Atc ${CliHelper.shellQuote(sql)}`,
          )
          .assertSuccess()
          .stdout.trim();

      await pmmTest.step(
        'Start PostgreSQL 17 with role grafana_ext owning database grafana_ext',
        async () => {
          externalPostgresStarted = true;
          await externalPostgresHelper.startPostgres(externalPostgres, false);
          cliHelper
            .execSilent(
              `docker exec ${externalPostgres} psql -U postgres -c "create role grafana_ext login password '${passwordF}'" -c "create database grafana_ext owner grafana_ext"`,
            )
            .assertSuccess();
        },
      );

      await pmmTest.step('Start PMM Server with Grafana on the external database', async () => {
        await startServer(
          { api, dockerHelper },
          imageUnderTest,
          newVolume('t2920'),
          `-e GF_DATABASE_URL=postgres://grafana_ext:${passwordF}@${externalPostgres}:5432/grafana_ext`,
        );
        verifyNoGrafanaExit(grafanaDatabaseHelper);
      });

      await pmmTest.step('Verify the Grafana role and database step did not run', async () => {
        const output = grafanaDatabaseHelper.containerOutput(container);

        expect(output, 'The container output must have been read').toContain('supervisord started');
        expect(output).not.toContain(ensuringGrafanaDatabase);
      });

      await pmmTest.step('Verify the built-in PostgreSQL has no grafana role or database', async () => {
        expect(
          grafanaDatabaseHelper.queryAsPostgres(
            container,
            "select count(*) from pg_database where datname = 'pmm-managed'",
          ),
          'The built-in PostgreSQL must hold the pmm-managed database',
        ).toEqual('1');
        expect(
          grafanaDatabaseHelper.queryAsPostgres(
            container,
            "select count(*) from pg_roles where rolname = 'grafana'",
          ),
        ).toEqual('0');
        expect(
          grafanaDatabaseHelper.queryAsPostgres(
            container,
            "select count(*) from pg_database where datname = 'grafana'",
          ),
        ).toEqual('0');
      });

      await pmmTest.step("Verify Grafana's tables are in the external database", async () => {
        expect(externalDatabase("select to_regclass('public.resource')")).toEqual('resource');
      });

      await pmmTest.step("Verify pmm-managed found and read Grafana's database", async () => {
        const pmmManagedLog = '/srv/logs/pmm-managed.log';

        expect(
          grafanaDatabaseHelper.countInContainer(container, pmmManagedLog, '.'),
          'pmm-managed.log lines',
        ).toBeGreaterThan(0);
        expect(
          grafanaDatabaseHelper.countInContainer(
            container,
            pmmManagedLog,
            "Cannot locate Grafana's database|datasource",
          ),
        ).toEqual(0);
      });

      await pmmTest.step(
        'Save dashboard "pmm-15919-ext" and find it in the UI and in the external database',
        async () => {
          grafanaDatabaseHelper.setAdminPassword(container);
          await grafanaHelper.authorize();

          const { uid, url } = await api.grafanaApi.createDashboard('pmm-15919-ext', canary.panel);

          await page.goto(url);
          await expect(dashboard.elements.panelName).toHaveText(canary.panel, {
            timeout: Timeouts.ONE_MINUTE,
          });
          expect(
            externalDatabase(
              `select count(*) from resource where "group" = 'dashboard.grafana.app' and name = '${uid}'`,
            ),
          ).toEqual('1');
        },
      );
    },
  );
});
