import Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
import DockerHelper from '@helpers/docker.helper';
import { Timeouts } from '@helpers/timeouts';
import { AdvisorCheckResultStatus, AdvisorCheckTechnology, AdvisorInsight } from '@interfaces/advisors';
import { AddServiceResponse } from '@interfaces/inventory';
import { expect } from '@playwright/test';

interface Database {
  credentials?: Record<string, string>;
  dockerArgs: string;
  port: number;
  type: keyof AddServiceResponse;
}

interface MonitoredDatabase {
  name: string;
  serviceId: string;
}

const credentials = { password: 'qa-advisors' };
const mongodb = (dockerArgs: string): Database => ({ dockerArgs, port: 27_017, type: 'mongodb' });
const mysql = (dockerArgs: string, passwordVariable = 'MYSQL_ROOT_PASSWORD'): Database => ({
  credentials: { ...credentials, username: 'root' },
  dockerArgs: `-e ${passwordVariable}=qa-advisors ${dockerArgs}`,
  port: 3_306,
  type: 'mysql',
});
const postgresql = (image: string): Database => ({
  credentials: { ...credentials, username: 'postgres' },
  dockerArgs: `-e POSTGRES_PASSWORD=qa-advisors ${image}`,
  port: 5_432,
  type: 'postgresql',
});
const containers: string[] = [];
const nodeIds: string[] = [];

// The Service filter of Insights matches substrings, so the shared suffix keeps one name from matching another.
const addDatabases = async <T extends string>(
  api: Api,
  dockerHelper: DockerHelper,
  databases: Record<T, Database>,
): Promise<Record<T, MonitoredDatabase>> => {
  const suffix = Date.now();
  const entries = Object.entries(databases) as [T, Database][];
  const monitored = {} as Record<T, MonitoredDatabase>;

  for (const [key, { dockerArgs }] of entries) {
    const name = `qa-${key}-${suffix}`;

    containers.push(name);
    dockerHelper.startContainer(name, dockerArgs);
  }

  for (const [key, { credentials: databaseCredentials, port, type }] of entries) {
    const name = `qa-${key}-${suffix}`;
    const service = await api.managementApi.addRemoteDatabase(type, name, port, databaseCredentials);

    nodeIds.push(service.node_id);
    monitored[key] = { name, serviceId: service.service_id };
  }

  return monitored;
};

const runChecks = async (api: Api, checkNames: string[], databases: MonitoredDatabase[]) => {
  const run = await api.advisorsApi.runChecksAndWait(
    checkNames,
    databases.map(({ serviceId }) => serviceId),
    Timeouts.FIVE_MINUTES,
  );
  const insights = await api.advisorsApi.listInsights({ page_size: '500', run_id: run.id });

  return {
    finding: ({ serviceId }: MonitoredDatabase, checkName: string): AdvisorInsight => {
      const insight = insights.find(
        ({ check_name, service_id }) => check_name === checkName && service_id === serviceId,
      );

      expect(insight, `No ${checkName} insight for service ${serviceId}`).toBeDefined();

      return insight as AdvisorInsight;
    },
    insightsOf: ({ serviceId }: MonitoredDatabase) =>
      insights.filter(({ service_id }) => service_id === serviceId),
    run,
  };
};

const daysSince = (date: string) =>
  Math.floor((Date.now() - Date.parse(date)) / (24 * 60 * Timeouts.ONE_MINUTE));

pmmTest.describe('Built-in Advisor version checks', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest.afterEach(async ({ api, cliHelper }) => {
    for (const container of containers.splice(0)) cliHelper.removeContainer(container);
    for (const nodeId of nodeIds.splice(0)) await api.inventoryApi.deleteNode(nodeId, true);
  });

  pmmTest(
    'PMM-T2622 - Verify agent-monitored MySQL, MongoDB and PostgreSQL past end of life each get one EOL error, with no check failing to run @advisor-versions',
    async ({ advisorInsightsPage, advisorsCatalogPage, api, page }) => {
      const eolChecks = ['mysql_unsupported_version_check', 'mongodb_EOL', 'postgresql_eol_check'];
      const retiredChecks = [
        'mongodb_cve_version',
        'mongodb_unsupported_version',
        'mysql_version_eol_57',
        'postgresql_cve_check',
        'postgresql_unsupported_check',
      ];
      const monitored = (services: { service_id: string; service_name: string }[]): MonitoredDatabase[] =>
        services.map(({ service_id, service_name }) => ({ name: service_name, serviceId: service_id }));
      // The services pmm-framework adds for ps=8.0, psmdb=6.0 and pgsql=14.
      const [ps] = monitored([await api.inventoryApi.getServiceDetailsByRegex('^ps_pmm_8_0_')]);
      const psmdb = monitored(await api.inventoryApi.getAllServiceDetailsByRegex('^rs10[1-3]_')).sort(
        (a, b) => a.name.localeCompare(b.name),
      );
      const [pgsql] = monitored([await api.inventoryApi.getServiceDetailsByRegex('^pgsql_pgss_pmm_14_')]);
      const checks = await api.advisorsApi.listChecks();
      const { builders, buttons, elements } = advisorInsightsPage;

      await pmmTest.step(
        'The retired checks are gone and the EOL checks are built in and enabled',
        async () => {
          expect(checks.filter(({ name }) => retiredChecks.includes(name))).toEqual([]);

          for (const name of eolChecks) {
            expect(checks.find((check) => check.name === name)).toMatchObject({
              enabled: true,
              user_defined: false,
            });
          }

          await page.goto(advisorsCatalogPage.url);

          for (const name of eolChecks) {
            await advisorsCatalogPage.inputs.search.fill(name);
            await expect(advisorsCatalogPage.builders.row(name)).toContainText('Built-in');
            await expect(advisorsCatalogPage.builders.statusSwitch(name)).toBeChecked();
          }

          for (const name of retiredChecks) {
            await advisorsCatalogPage.inputs.search.fill(name);
            await expect(advisorsCatalogPage.messages.noChecks).toBeVisible();
            await expect(advisorsCatalogPage.builders.row(name)).toHaveCount(0);
          }
        },
      );

      const builtinChecks = checks
        .filter(
          ({ enabled, technology, user_defined }) =>
            enabled &&
            !user_defined &&
            [
              AdvisorCheckTechnology.mongodb,
              AdvisorCheckTechnology.mysql,
              AdvisorCheckTechnology.postgresql,
            ].includes(technology),
        )
        .map(({ name }) => name);
      const { finding, insightsOf, run } = await runChecks(api, builtinChecks, [ps, ...psmdb, pgsql]);

      await pmmTest.step('Every planned check runs without an error', async () => {
        const errors = [ps, ...psmdb, pgsql]
          .flatMap((service) => insightsOf(service))
          .filter(({ status }) => status === AdvisorCheckResultStatus.error)
          .map(({ check_name, outcome, service_name }) => `${service_name} ${check_name}: ${outcome}`);

        expect(errors).toEqual([]);
        expect(run.services_count).toEqual(psmdb.length + 2);
        expect(run.checks_count).toEqual(run.planned_checks_count);
        await page.goto(advisorInsightsPage.runUrl(run.id));
        await advisorInsightsPage.selectFilter('status', 'Error');
        await expect(elements.noData).toBeVisible();
      });

      await page.goto(advisorInsightsPage.runUrl(run.id));
      await advisorInsightsPage.selectFilter('category', 'Versions');

      await pmmTest.step('Percona Server 8.0 reached end of life on 2026-04-01', async () => {
        const eol = finding(ps, 'mysql_unsupported_version_check');

        await advisorInsightsPage.selectFilter('serviceName', ps.name);
        await expect(builders.row(eol.id)).toContainText('Percona Server for MySQL 8.0 reached end of life');
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toContainText(
          'Percona Server for MySQL 8.0 reached end of life',
        );
        await builders.row(eol.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText('End-of-Life date on 2026-04-01');
        await buttons.closeDetails.click();
      });

      await pmmTest.step(
        'PSMDB 6.0 reached end of life and keeps its default journal and log level',
        async () => {
          const [member] = psmdb;

          await advisorInsightsPage.selectFilter('serviceName', member.name);
          await expect(builders.row(finding(member, 'mongodb_EOL').id)).toContainText(
            'MongoDB 6.0 reached end of life',
          );
          await expect(builders.rowsWithCell('Error')).toHaveCount(1);
          await expect(builders.rowsWithCell('Error')).toContainText('MongoDB 6.0 reached end of life');
          await advisorInsightsPage.selectFilter('category', 'All');
          await expect(builders.row(finding(member, 'mongodb_journal').id)).toBeVisible();
          await expect(builders.rowsWithText('MongoDB journaling is disabled')).toHaveCount(0);
          await expect(builders.rowsWithText('MongoDB is not using the default log level.')).toHaveCount(0);

          for (const service of psmdb) {
            for (const checkName of ['mongodb_journal', 'mongodb_loglevel']) {
              expect(finding(service, checkName).status, `${service.name} ${checkName}`).toEqual(
                AdvisorCheckResultStatus.ok,
              );
            }
          }
        },
      );

      await pmmTest.step('PostgreSQL 14 reached end of life on 2026-11-12', async () => {
        const eol = finding(pgsql, 'postgresql_eol_check');

        await advisorInsightsPage.selectFilter('category', 'Versions');
        await advisorInsightsPage.selectFilter('serviceName', pgsql.name);
        await expect(builders.row(eol.id)).toContainText('PostgreSQL 14 reached end of life');
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toContainText('PostgreSQL 14 reached end of life');
        await builders.row(eol.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText('End-of-Life date on 2026-11-12');
      });
    },
  );

  pmmTest(
    'PMM-T2623 - Verify MySQL, Percona Server and MariaDB get end-of-life errors and newer-version advice from their own release series @advisor-versions',
    async ({ advisorInsightsPage, api, dockerHelper, page }) => {
      const eolCheck = 'mysql_unsupported_version_check';
      const versionCheck = 'mysql_version';
      const databases = await addDatabases(api, dockerHelper, {
        mariadb106: mysql('mariadb:10.6', 'MARIADB_ROOT_PASSWORD'),
        mariadb10119: mysql('mariadb:10.11.9', 'MARIADB_ROOT_PASSWORD'),
        mysql57: mysql('--platform linux/amd64 mysql:5.7'),
        mysql80: mysql('mysql:8.0'),
        mysql840: mysql('mysql:8.4.0'),
        mysql8037: mysql('mysql:8.0.37'),
        ps971: mysql('percona/percona-server:9.7.1'),
      });
      const { finding, insightsOf, run } = await runChecks(
        api,
        [eolCheck, versionCheck],
        Object.values(databases),
      );
      const { builders, buttons } = advisorInsightsPage;

      await page.goto(advisorInsightsPage.runUrl(run.id));
      await advisorInsightsPage.selectFilter('category', 'Versions');

      await pmmTest.step('MySQL 8.0.46 reached end of life and has no newer version', async () => {
        const eol = finding(databases.mysql80, eolCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases.mysql80.name);
        await expect(builders.row(eol.id)).toContainText('MySQL 8.0 reached end of life');
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toContainText('MySQL 8.0 reached end of life');
        await expect(builders.rowsWithText('Newer version of MySQL is available')).toHaveCount(0);
        await builders.row(eol.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText('End-of-Life date on 2026-04-30');
        await buttons.closeDetails.click();
      });

      await pmmTest.step('MySQL 8.0.37 reached end of life and is told about 8.0.46', async () => {
        const newer = finding(databases.mysql8037, versionCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases.mysql8037.name);
        await expect(builders.row(finding(databases.mysql8037, eolCheck).id)).toContainText(
          'MySQL 8.0 reached end of life',
        );
        await expect(builders.rowsWithCell('Error')).toContainText('MySQL 8.0 reached end of life');
        await expect(builders.row(newer.id)).toContainText('Newer version of MySQL is available');
        await expect(builders.row(newer.id)).toContainText('Warning');
        await builders.row(newer.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText(
          'Current version is 8.0.37, the latest available version is 8.0.46.',
        );
        await expect(builders.detailsField('outcome')).toContainText(
          'The newer release includes security fixes: https://www.oracle.com/security-alerts/',
        );
        await buttons.closeDetails.click();
      });

      await pmmTest.step('MySQL 5.7 gets exactly one end-of-life error', async () => {
        await advisorInsightsPage.selectFilter('serviceName', databases.mysql57.name);
        await expect(builders.row(finding(databases.mysql57, eolCheck).id)).toBeVisible();
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toContainText('MySQL 5.7 reached end of life');
      });

      await pmmTest.step('MySQL 8.4.0 is compared with the 8.4 series', async () => {
        const newer = finding(databases.mysql840, versionCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases.mysql840.name);
        await expect(builders.row(newer.id)).toContainText('Newer version of MySQL is available');
        await expect(builders.row(newer.id)).toContainText('Warning');
        await expect(builders.rowsWithText('end of life')).toHaveCount(0);
        await builders.row(newer.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText(
          /Current version is 8\.4\.0, the latest available version is 8\.4\.[1-9]\d*\./,
        );
        await expect(builders.detailsField('outcome')).not.toContainText('8.0.38');
        await buttons.closeDetails.click();
      });

      await pmmTest.step('Percona Server 9.7.1 is compared with the 9.7 series', async () => {
        const newer = finding(databases.ps971, versionCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases.ps971.name);
        await expect(builders.row(newer.id)).toContainText(
          'Newer version of Percona Server for MySQL is available',
        );
        await expect(builders.row(newer.id)).toContainText('Warning');
        await expect(builders.rowsWithText('end of life')).toHaveCount(0);
        await builders.row(newer.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText(
          /the latest available version is 9\.7\.(?:[2-9]|[1-9]\d+)\./,
        );
        await buttons.closeDetails.click();
      });

      await pmmTest.step('MariaDB 10.6 gets exactly one end-of-life error and no 10.9.2 advice', async () => {
        await advisorInsightsPage.selectFilter('serviceName', databases.mariadb106.name);
        await expect(builders.row(finding(databases.mariadb106, eolCheck).id)).toBeVisible();
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toContainText('MariaDB 10.6 reached end of life');
        await expect(builders.rowsWithText('10.9.2')).toHaveCount(0);
        expect(insightsOf(databases.mariadb106).filter(({ outcome }) => outcome.includes('10.9.2'))).toEqual(
          [],
        );
      });

      await pmmTest.step('MariaDB 10.11.9 is compared with the 10.11 series', async () => {
        const newer = finding(databases.mariadb10119, versionCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases.mariadb10119.name);
        await expect(builders.row(newer.id)).toContainText('Newer version of MariaDB is available');
        await expect(builders.row(newer.id)).toContainText('Warning');
        await expect(builders.rowsWithText('end of life')).toHaveCount(0);
        await builders.row(newer.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText(
          /Current version is 10\.11\.9, the latest available version is 10\.11\.[1-9]\d+\./,
        );
        await expect(builders.detailsField('outcome')).toContainText(
          'https://mariadb.org/about/security-policy/',
        );
        await expect(builders.detailsField('outcome')).not.toContainText('10.9.2');
      });
    },
  );

  pmmTest(
    'PMM-T2624 - Verify MongoDB 4.2 and 4.4 each get exactly one end-of-life error and MongoDB 8.0 gets none @advisor-versions',
    async ({ advisorInsightsPage, api, dockerHelper, page }) => {
      const eolCheck = 'mongodb_EOL';
      const databases = await addDatabases(api, dockerHelper, {
        mongo42: mongodb('mongo:4.2'),
        mongo44: mongodb('mongo:4.4'),
        mongo80: mongodb('mongo:8.0'),
      });
      const { finding, run } = await runChecks(api, [eolCheck, 'mongodb_version'], Object.values(databases));
      const { builders, buttons } = advisorInsightsPage;

      await page.goto(advisorInsightsPage.runUrl(run.id));
      await advisorInsightsPage.selectFilter('category', 'Versions');

      await pmmTest.step('MongoDB 4.4 reached end of life on 2024-02-29', async () => {
        const eol = finding(databases.mongo44, eolCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases.mongo44.name);
        await expect(builders.row(eol.id)).toContainText('MongoDB 4.4 reached end of life');
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toContainText('MongoDB 4.4 reached end of life');
        await expect(builders.rowsWithText(/reaches end of life|about to reach/i)).toHaveCount(0);
        await builders.row(eol.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText('End-of-Life date on 2024-02-29');
        await buttons.closeDetails.click();
      });

      await pmmTest.step('MongoDB 4.2 gets exactly one end-of-life error', async () => {
        await advisorInsightsPage.selectFilter('serviceName', databases.mongo42.name);
        await expect(builders.row(finding(databases.mongo42, eolCheck).id)).toBeVisible();
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toContainText('MongoDB 4.2 reached end of life');
      });

      await pmmTest.step('MongoDB 8.0 gets no end-of-life finding', async () => {
        await advisorInsightsPage.selectFilter('serviceName', databases.mongo80.name);
        await expect(builders.row(finding(databases.mongo80, eolCheck).id)).toBeVisible();
        await expect(builders.rowsWithText('end of life')).toHaveCount(0);
      });
    },
  );

  pmmTest(
    'PMM-T2625 - Verify PostgreSQL 13 is reported as end of life with its full version and PostgreSQL 17 is not @advisor-versions',
    async ({ advisorInsightsPage, api, dockerHelper, page }) => {
      const eolCheck = 'postgresql_eol_check';
      const versionCheck = 'postgresql_version_check';
      const eolDate = '2025-11-13';
      const databases = await addDatabases(api, dockerHelper, {
        pg13: postgresql('postgres:13'),
        pg17: postgresql('postgres:17'),
      });
      const daysBeforeRun = daysSince(eolDate);
      const { finding, run } = await runChecks(api, [eolCheck, versionCheck], Object.values(databases));
      const { builders, buttons, elements } = advisorInsightsPage;

      await page.goto(advisorInsightsPage.runUrl(run.id));
      await advisorInsightsPage.selectFilter('category', 'Versions');

      await pmmTest.step('PostgreSQL 13.23 reached end of life', async () => {
        const eol = finding(databases.pg13, eolCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases.pg13.name);
        await expect(builders.row(eol.id)).toContainText('PostgreSQL 13 reached end of life');
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toContainText('PostgreSQL 13 reached end of life');
        await builders.row(eol.id).dblclick();
        await expect(builders.detailsLabel('current', '13.23')).toBeVisible();
        await expect(builders.detailsLabel('current', '13.3')).toBeHidden();
        await expect(builders.detailsField('outcome')).toContainText(`End-of-Life date on ${eolDate}`);
        await buttons.closeDetails.click();
      });

      await pmmTest.step('The version check names a newer major and points to security fixes', async () => {
        const newer = finding(databases.pg13, versionCheck);
        const days = new Set([daysBeforeRun, daysSince(eolDate)]);

        await expect(builders.row(newer.id)).toContainText('Currently installed version is (13.23)');
        await builders.row(newer.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText(
          /there is a newer major version \((?:1[4-9]|[2-9]\d)\.\d+\) available/,
        );
        await expect(builders.detailsField('outcome')).toContainText(
          new RegExp(`The version currently installed expired (${[...days].join('|')}) days ago`),
        );
        await expect(builders.detailsField('outcome')).toContainText(
          'The newer release includes security fixes: https://www.postgresql.org/support/security/',
        );
        await buttons.closeDetails.click();
        await expect(elements.detailsPane).toBeHidden();
      });

      await pmmTest.step('PostgreSQL 17 gets no end-of-life finding', async () => {
        await advisorInsightsPage.selectFilter('serviceName', databases.pg17.name);
        await expect(builders.row(finding(databases.pg17, eolCheck).id)).toBeVisible();
        await expect(builders.rowsWithText('end of life')).toHaveCount(0);
      });
    },
  );

  pmmTest(
    'PMM-T2627 - Verify MongoDB journal and log level warnings appear only for settings changed explicitly @advisor-versions',
    async ({ advisorInsightsPage, api, dockerHelper, page }) => {
      const journalCheck = 'mongodb_journal';
      const logLevelCheck = 'mongodb_loglevel';
      const journalDisabled = 'MongoDB journaling is disabled';
      const logLevelChanged = 'MongoDB is not using the default log level.';
      const databases = await addDatabases(api, dockerHelper, {
        mongo60: mongodb('mongo:6.0'),
        'mongo60-nojournal': mongodb('mongo:6.0 --nojournal'),
        'mongo82-loglevel': mongodb('mongo:8.2 --setParameter logLevel=1'),
      });
      const { finding, run } = await runChecks(api, [journalCheck, logLevelCheck], Object.values(databases));
      const { builders, elements } = advisorInsightsPage;

      await page.goto(advisorInsightsPage.runUrl(run.id));
      await advisorInsightsPage.selectFilter('status', 'Failed');

      await pmmTest.step('A raised log level is reported', async () => {
        const insight = finding(databases['mongo82-loglevel'], logLevelCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases['mongo82-loglevel'].name);
        await expect(builders.row(insight.id)).toContainText(logLevelChanged);
        await expect(builders.row(insight.id)).toContainText('Warning');
      });

      await pmmTest.step('A disabled journal is reported', async () => {
        const insight = finding(databases['mongo60-nojournal'], journalCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases['mongo60-nojournal'].name);
        await expect(builders.row(insight.id)).toContainText(journalDisabled);
        await expect(builders.row(insight.id)).toContainText('Warning');
      });

      await pmmTest.step('MongoDB 6.0 with default settings gets neither warning', async () => {
        expect(finding(databases.mongo60, journalCheck).status).toEqual(AdvisorCheckResultStatus.ok);
        expect(finding(databases.mongo60, logLevelCheck).status).toEqual(AdvisorCheckResultStatus.ok);
        await advisorInsightsPage.selectFilter('serviceName', databases.mongo60.name);
        await expect(elements.noData).toBeVisible();
        await expect(builders.rowsWithText(journalDisabled)).toHaveCount(0);
        await expect(builders.rowsWithText(logLevelChanged)).toHaveCount(0);
      });
    },
  );
});
