import pmmTest from '@fixtures/pmmTest';
import {
  MonitoredDatabase,
  remoteMongodb,
  remoteMysql,
  remotePostgresql,
} from '@helpers/remoteDatabases.helper';
import { AdvisorCheckResultStatus, AdvisorCheckTechnology } from '@interfaces/advisors';
import { expect } from '@playwright/test';

pmmTest.describe('Built-in Advisor version checks', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T2622 - Verify agent-monitored MySQL, MongoDB and PostgreSQL past end of life each get one EOL error and no newer-version warning, with no check failing to run @advisor-versions',
    async ({ advisorInsightsPage, advisorsCatalogPage, api, page }) => {
      const versionChecks = ['mysql_version', 'mongodb_version', 'postgresql_version_check'];
      const retiredChecks = [
        'mongodb_EOL',
        'mongodb_cve_version',
        'mongodb_unsupported_version',
        'mysql_unsupported_version_check',
        'mysql_version_eol_57',
        'postgresql_cve_check',
        'postgresql_eol_check',
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
      const services = [ps, ...psmdb, pgsql];
      const checks = await api.advisorsApi.listChecks();
      const { builders, buttons, elements } = advisorInsightsPage;

      await pmmTest.step(
        'The retired checks are gone and the version checks are built in and enabled',
        async () => {
          expect(checks.filter(({ name }) => retiredChecks.includes(name))).toEqual([]);

          for (const name of versionChecks) {
            expect(checks.find((check) => check.name === name)).toMatchObject({
              enabled: true,
              user_defined: false,
            });
          }

          await page.goto(advisorsCatalogPage.url);

          for (const name of versionChecks) {
            await advisorsCatalogPage.inputs.search.fill(name);
            await expect(advisorsCatalogPage.builders.row(name)).toContainText('Built-in');
            await expect(advisorsCatalogPage.builders.statusSwitch(name)).toBeChecked();
          }

          // Each search starts from a listed check, so "No checks" can only come from the retired name.
          for (const name of retiredChecks) {
            await advisorsCatalogPage.inputs.search.fill(versionChecks[0]);
            await expect(advisorsCatalogPage.builders.row(versionChecks[0])).toBeVisible();
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
      const { insightOf, insights, run } = await api.advisorsApi.runChecksAndListInsights(
        builtinChecks,
        services.map(({ serviceId }) => serviceId),
      );

      await pmmTest.step('Every planned check runs without an error', async () => {
        const errors = insights
          .filter(({ status }) => status === AdvisorCheckResultStatus.error)
          .map(({ check_name, outcome, service_name }) => `${service_name} ${check_name}: ${outcome}`);

        expect(errors).toEqual([]);
        expect(run.services_count).toEqual(services.length);
        expect(run.checks_count).toEqual(run.planned_checks_count);
        await page.goto(advisorInsightsPage.runUrl(run.id));
        await advisorInsightsPage.selectFilter('status', 'Error');
        await expect(elements.noData).toBeVisible();
      });

      await page.goto(advisorInsightsPage.runUrl(run.id));
      await advisorInsightsPage.selectFilter('category', 'Versions');

      await pmmTest.step('Percona Server 8.0 reached end of life on 2026-04-01', async () => {
        const eol = insightOf(ps.serviceId, 'mysql_version');

        await advisorInsightsPage.selectFilter('serviceName', ps.name);
        await expect(elements.rows).toHaveCount(1);
        await expect(builders.rowsWithCell('Percona Server for MySQL 8.0 reached end of life')).toHaveCount(
          1,
        );
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
        await builders.row(eol.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText('End-of-Life date on 2026-04-01');
        await buttons.closeDetails.click();
      });

      await pmmTest.step(
        'Each PSMDB 6.0 member reached end of life and keeps its default journal and log level',
        async () => {
          for (const service of psmdb) {
            expect(insightOf(service.serviceId, 'mongodb_version'), service.name).toMatchObject({
              severity: 'SEVERITY_ERROR',
              status: AdvisorCheckResultStatus.failed,
              summary: 'Percona Server for MongoDB 6.0 reached end of life',
            });

            for (const checkName of ['mongodb_journal', 'mongodb_loglevel']) {
              expect(insightOf(service.serviceId, checkName).status, `${service.name} ${checkName}`).toEqual(
                AdvisorCheckResultStatus.ok,
              );
            }
          }

          const [member] = psmdb;

          await advisorInsightsPage.selectFilter('serviceName', member.name);
          await expect(elements.rows).toHaveCount(1);
          await expect(
            builders.rowsWithCell('Percona Server for MongoDB 6.0 reached end of life'),
          ).toHaveCount(1);
          await expect(builders.rowsWithCell('Error')).toHaveCount(1);
          await advisorInsightsPage.selectFilter('category', 'All');
          await expect(builders.row(insightOf(member.serviceId, 'mongodb_journal').id)).toBeVisible();
          await expect(builders.rowsWithText('MongoDB journaling is disabled')).toHaveCount(0);
          await expect(builders.rowsWithText('MongoDB is not using the default log level.')).toHaveCount(0);
        },
      );

      await pmmTest.step('PostgreSQL 14 reached end of life on 2026-11-12', async () => {
        const eol = insightOf(pgsql.serviceId, 'postgresql_version_check');

        await advisorInsightsPage.selectFilter('category', 'Versions');
        await advisorInsightsPage.selectFilter('serviceName', pgsql.name);
        await expect(elements.rows).toHaveCount(1);
        await expect(builders.rowsWithCell('PostgreSQL 14 reached end of life')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
        await builders.row(eol.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText('End-of-Life date on 2026-11-12');
      });
    },
  );

  pmmTest(
    'PMM-T2623 - Verify MySQL, Percona Server and MariaDB past end of life get only an end-of-life error and supported series get newer-version advice from their own release series @advisor-versions',
    async ({ advisorInsightsPage, api, page, remoteDatabasesHelper }) => {
      const versionCheck = 'mysql_version';
      const databases = await remoteDatabasesHelper.add({
        mariadb106: remoteMysql('mariadb:10.6', 'MARIADB_ROOT_PASSWORD'),
        mariadb1142: remoteMysql('mariadb:11.4.2', 'MARIADB_ROOT_PASSWORD'),
        mysql57: remoteMysql('--platform linux/amd64 mysql:5.7'),
        mysql80: remoteMysql('mysql:8.0'),
        mysql840: remoteMysql('mysql:8.4.0'),
        mysql8037: remoteMysql('mysql:8.0.37'),
        ps80: remoteMysql('percona/percona-server:8.0'),
        ps971: remoteMysql('percona/percona-server:9.7.1'),
      });
      const { insightOf, run } = await api.advisorsApi.runChecksAndListInsights(
        [versionCheck],
        Object.values(databases).map(({ serviceId }) => serviceId),
      );
      const { builders, buttons, elements } = advisorInsightsPage;

      await page.goto(advisorInsightsPage.runUrl(run.id));
      await advisorInsightsPage.selectFilter('category', 'Versions');

      await pmmTest.step('MySQL 8.0 on its latest patch reached end of life', async () => {
        const eol = insightOf(databases.mysql80.serviceId, versionCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases.mysql80.name);
        await expect(elements.rows).toHaveCount(1);
        await expect(builders.rowsWithCell('MySQL 8.0 reached end of life')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
        await builders.row(eol.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText('End-of-Life date on 2026-04-30');
        await buttons.closeDetails.click();
      });

      await pmmTest.step(
        'MySQL 8.0.37 reached end of life and is not told about a newer 8.0 release',
        async () => {
          const eol = insightOf(databases.mysql8037.serviceId, versionCheck);

          await advisorInsightsPage.selectFilter('serviceName', databases.mysql8037.name);
          await expect(elements.rows).toHaveCount(1);
          await expect(builders.rowsWithCell('MySQL 8.0 reached end of life')).toHaveCount(1);
          await expect(builders.rowsWithCell('Error')).toHaveCount(1);
          await builders.row(eol.id).dblclick();
          await expect(builders.detailsField('outcome')).toContainText(
            'Upgrade to a supported release series.',
          );
          await expect(builders.detailsField('outcome')).not.toContainText('8.0.46');
          await expect(builders.detailsField('outcome')).not.toContainText('Release notes');
          await expect(builders.detailsField('outcome')).not.toContainText('can include security fixes');
          await buttons.closeDetails.click();
        },
      );

      await pmmTest.step(
        'Percona Server 8.0 reached end of life on its Percona date, 2026-04-01',
        async () => {
          const eol = insightOf(databases.ps80.serviceId, versionCheck);

          await advisorInsightsPage.selectFilter('serviceName', databases.ps80.name);
          await expect(elements.rows).toHaveCount(1);
          await expect(builders.rowsWithCell('Percona Server for MySQL 8.0 reached end of life')).toHaveCount(
            1,
          );
          await expect(builders.rowsWithCell('Error')).toHaveCount(1);
          await builders.row(eol.id).dblclick();
          await expect(builders.detailsField('outcome')).toContainText('End-of-Life date on 2026-04-01');
          await expect(builders.detailsField('outcome')).toContainText(
            'Lifecycle policy: https://www.percona.com/release-lifecycle-overview/.',
          );
          await buttons.closeDetails.click();
        },
      );

      await pmmTest.step('MySQL 5.7 gets exactly one end-of-life error', async () => {
        await advisorInsightsPage.selectFilter('serviceName', databases.mysql57.name);
        await expect(elements.rows).toHaveCount(1);
        await expect(builders.rowsWithCell('MySQL 5.7 reached end of life')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
      });

      await pmmTest.step('MySQL 8.4.0 is compared with the 8.4 series', async () => {
        const newer = insightOf(databases.mysql840.serviceId, versionCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases.mysql840.name);
        await expect(elements.rows).toHaveCount(1);
        await expect(builders.rowsWithCell('Newer version of MySQL is available')).toHaveCount(1);
        await expect(builders.rowsWithCell('Warning')).toHaveCount(1);
        await builders.row(newer.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText(
          /Current version is 8\.4\.0, the latest release of MySQL 8\.4 is 8\.4\.[1-9]\d*\./,
        );
        await expect(builders.detailsField('outcome')).toContainText(
          'Release notes: https://dev.mysql.com/doc/relnotes/mysql/8.4/en/.',
        );
        await buttons.closeDetails.click();
      });

      await pmmTest.step('Percona Server 9.7.1 is compared with the 9.7 series', async () => {
        const newer = insightOf(databases.ps971.serviceId, versionCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases.ps971.name);
        await expect(elements.rows).toHaveCount(1);
        await expect(
          builders.rowsWithCell('Newer version of Percona Server for MySQL is available'),
        ).toHaveCount(1);
        await expect(builders.rowsWithCell('Warning')).toHaveCount(1);
        await builders.row(newer.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText(
          /the latest release of Percona Server for MySQL 9\.7 is 9\.7\.(?:[2-9]|[1-9]\d+)\./,
        );
        await expect(builders.detailsField('outcome')).toContainText(
          'Release notes: https://docs.percona.com/percona-server/9.7/',
        );
        await buttons.closeDetails.click();
      });

      await pmmTest.step('MariaDB 10.6 gets exactly one end-of-life error and no 10.9.2 advice', async () => {
        const eol = insightOf(databases.mariadb106.serviceId, versionCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases.mariadb106.name);
        await expect(elements.rows).toHaveCount(1);
        await expect(builders.rowsWithCell('MariaDB 10.6 reached end of life')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
        expect(eol.outcome).not.toContain('10.9.2');
        expect(eol.outcome).toContain('Lifecycle policy: https://mariadb.org/about/#maintenance-policy.');
      });

      await pmmTest.step('MariaDB 11.4.2 is compared with the 11.4 series', async () => {
        const newer = insightOf(databases.mariadb1142.serviceId, versionCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases.mariadb1142.name);
        await expect(elements.rows).toHaveCount(1);
        await expect(builders.rowsWithCell('Newer version of MariaDB is available')).toHaveCount(1);
        await expect(builders.rowsWithCell('Warning')).toHaveCount(1);
        await builders.row(newer.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText(
          /Current version is 11\.4\.2-MariaDB\S*, the latest release of MariaDB 11\.4 is 11\.4\.(?:[3-9]|[1-9]\d+)\./,
        );
        await expect(builders.detailsField('outcome')).toContainText(
          'https://mariadb.com/docs/server/security/cve/community-server',
        );
      });
    },
  );

  pmmTest(
    'PMM-T2624 - Verify MongoDB 4.2 and 4.4 each get exactly one end-of-life error and no newer-version warning, and MongoDB 8.0 gets no end-of-life finding @advisor-versions',
    async ({ advisorInsightsPage, api, page, remoteDatabasesHelper }) => {
      const versionCheck = 'mongodb_version';
      const databases = await remoteDatabasesHelper.add({
        mongo42: remoteMongodb('mongo:4.2'),
        mongo44: remoteMongodb('mongo:4.4'),
        mongo80: remoteMongodb('mongo:8.0'),
      });
      const { insightOf, run } = await api.advisorsApi.runChecksAndListInsights(
        [versionCheck],
        Object.values(databases).map(({ serviceId }) => serviceId),
      );
      const { builders, buttons, elements } = advisorInsightsPage;

      await page.goto(advisorInsightsPage.runUrl(run.id));
      await advisorInsightsPage.selectFilter('category', 'Versions');

      await pmmTest.step('MongoDB 4.4 reached end of life on 2024-02-29', async () => {
        const eol = insightOf(databases.mongo44.serviceId, versionCheck);

        await advisorInsightsPage.selectFilter('serviceName', databases.mongo44.name);
        await expect(elements.rows).toHaveCount(1);
        await expect(builders.rowsWithCell('MongoDB 4.4 reached end of life')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
        await builders.row(eol.id).dblclick();
        await expect(builders.detailsField('outcome')).toContainText('End-of-Life date on 2024-02-29');
        await expect(builders.detailsField('outcome')).toContainText(
          'Lifecycle policy: https://www.mongodb.com/legal/support-policy/lifecycles.',
        );
        await expect(builders.detailsField('outcome')).not.toContainText('Release notes');
        await buttons.closeDetails.click();
      });

      await pmmTest.step('MongoDB 4.2 gets exactly one end-of-life error', async () => {
        await advisorInsightsPage.selectFilter('serviceName', databases.mongo42.name);
        await expect(elements.rows).toHaveCount(1);
        await expect(builders.rowsWithCell('MongoDB 4.2 reached end of life')).toHaveCount(1);
        await expect(builders.rowsWithCell('Error')).toHaveCount(1);
      });

      await pmmTest.step(
        'MongoDB 8.0 gets no end-of-life finding, only MongoDB newer-version advice',
        async () => {
          const newer = insightOf(databases.mongo80.serviceId, versionCheck);

          await advisorInsightsPage.selectFilter('serviceName', databases.mongo80.name);
          await expect(elements.rows).toHaveCount(1);
          await expect(builders.rowsWithCell('Newer version of MongoDB is available')).toHaveCount(1);
          await expect(builders.rowsWithCell('Warning')).toHaveCount(1);
          expect(newer.outcome).toMatch(
            /Release notes: https:\/\/www\.mongodb\.com\/docs\/manual\/release-notes\/\d+\.\d+\/\./,
          );
        },
      );
    },
  );

  pmmTest(
    'PMM-T2625 - Verify PostgreSQL 13 gets only an end-of-life error with its full version and PostgreSQL 17 gets newer-version advice @advisor-versions',
    async ({ advisorInsightsPage, api, page, remoteDatabasesHelper }) => {
      const versionCheck = 'postgresql_version_check';
      const databases = await remoteDatabasesHelper.add({
        pg13: remotePostgresql('postgres:13.23'),
        pg17: remotePostgresql('postgres:17.11'),
      });
      const { insightOf, run } = await api.advisorsApi.runChecksAndListInsights(
        [versionCheck],
        Object.values(databases).map(({ serviceId }) => serviceId),
      );
      const { builders, buttons, elements } = advisorInsightsPage;

      await page.goto(advisorInsightsPage.runUrl(run.id));
      await advisorInsightsPage.selectFilter('category', 'Versions');

      await pmmTest.step(
        'PostgreSQL 13.23 reached end of life and gets no newer-version advice',
        async () => {
          const eol = insightOf(databases.pg13.serviceId, versionCheck);

          await advisorInsightsPage.selectFilter('serviceName', databases.pg13.name);
          await expect(elements.rows).toHaveCount(1);
          await expect(builders.rowsWithCell('PostgreSQL 13 reached end of life')).toHaveCount(1);
          await expect(builders.rowsWithCell('Error')).toHaveCount(1);
          await builders.row(eol.id).dblclick();
          await expect(builders.detailsLabel('current', '13.23')).toBeVisible();
          await expect(builders.detailsField('outcome')).toContainText('End-of-Life date on 2025-11-13');
          await expect(builders.detailsField('outcome')).toContainText(
            'Lifecycle policy: https://www.postgresql.org/support/versioning/.',
          );
          await expect(builders.detailsField('outcome')).not.toContainText('newer');
          await buttons.closeDetails.click();
        },
      );

      await pmmTest.step(
        'PostgreSQL 17.11 gets newer-version advice with release notes and the security page',
        async () => {
          const newer = insightOf(databases.pg17.serviceId, versionCheck);

          await advisorInsightsPage.selectFilter('serviceName', databases.pg17.name);
          await expect(elements.rows).toHaveCount(1);
          await expect(builders.rowsWithCell('Newer version of PostgreSQL is available')).toHaveCount(1);
          await expect(builders.rowsWithCell('Warning')).toHaveCount(1);
          await builders.row(newer.id).dblclick();
          await expect(builders.detailsField('outcome')).toContainText(
            /Current version is 17\.11, the latest release of PostgreSQL 17 is 17\.(?:1[2-9]|[2-9]\d)\./,
          );
          await expect(builders.detailsField('outcome')).toContainText(
            'PostgreSQL 17 reaches end of life on 2029-11-08.',
          );
          await expect(builders.detailsField('outcome')).toContainText(
            /Release notes: https:\/\/www\.postgresql\.org\/docs\/release\/17\.\d+\/\./,
          );
          await expect(builders.detailsField('outcome')).toContainText(
            'Newer releases can include security fixes; see which ones affect your version: https://www.postgresql.org/support/security/.',
          );
          await buttons.closeDetails.click();
          await expect(elements.detailsPane).toBeHidden();
        },
      );
    },
  );

  pmmTest(
    'PMM-T2627 - Verify MongoDB journal and log level warnings appear only for settings changed explicitly @advisor-versions',
    async ({ advisorInsightsPage, api, page, remoteDatabasesHelper }) => {
      const journalCheck = 'mongodb_journal';
      const logLevelCheck = 'mongodb_loglevel';
      const journalDisabled = 'MongoDB journaling is disabled';
      const logLevelChanged = 'MongoDB is not using the default log level.';
      const databases = await remoteDatabasesHelper.add({
        mongo60: remoteMongodb('mongo:6.0'),
        'mongo60-nojournal': remoteMongodb('mongo:6.0 --nojournal'),
        'mongo82-loglevel': remoteMongodb('mongo:8.2 --setParameter logLevel=1'),
      });
      const { insightOf, run } = await api.advisorsApi.runChecksAndListInsights(
        [journalCheck, logLevelCheck],
        Object.values(databases).map(({ serviceId }) => serviceId),
      );
      const { builders, elements } = advisorInsightsPage;

      await page.goto(advisorInsightsPage.runUrl(run.id));
      await advisorInsightsPage.selectFilter('status', 'Failed');

      await pmmTest.step('A raised log level is reported, and only the log level', async () => {
        const service = databases['mongo82-loglevel'];
        const insight = insightOf(service.serviceId, logLevelCheck);

        expect(insightOf(service.serviceId, journalCheck).status).toEqual(AdvisorCheckResultStatus.ok);
        await advisorInsightsPage.selectFilter('serviceName', service.name);
        await expect(builders.row(insight.id)).toContainText(logLevelChanged);
        await expect(builders.row(insight.id)).toContainText('Warning');
        await expect(builders.rowsWithText(journalDisabled)).toHaveCount(0);
      });

      await pmmTest.step('A disabled journal is reported, and only the journal', async () => {
        const service = databases['mongo60-nojournal'];
        const insight = insightOf(service.serviceId, journalCheck);

        expect(insightOf(service.serviceId, logLevelCheck).status).toEqual(AdvisorCheckResultStatus.ok);
        await advisorInsightsPage.selectFilter('serviceName', service.name);
        await expect(builders.row(insight.id)).toContainText(journalDisabled);
        await expect(builders.row(insight.id)).toContainText('Warning');
        await expect(builders.rowsWithText(logLevelChanged)).toHaveCount(0);
      });

      await pmmTest.step('MongoDB 6.0 with default settings gets neither warning', async () => {
        expect(insightOf(databases.mongo60.serviceId, journalCheck).status).toEqual(
          AdvisorCheckResultStatus.ok,
        );
        expect(insightOf(databases.mongo60.serviceId, logLevelCheck).status).toEqual(
          AdvisorCheckResultStatus.ok,
        );
        await advisorInsightsPage.selectFilter('serviceName', databases.mongo60.name);
        await expect(elements.noData).toBeVisible();
      });
    },
  );
});
