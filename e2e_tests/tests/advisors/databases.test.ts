import pmmTest from '@fixtures/pmmTest';
import { remoteMongodb, remoteMysql, remotePostgresql } from '@helpers/remoteDatabases.helper';
import { AdvisorCheckResultStatus, AdvisorCheckTechnology, AdvisorInsight } from '@interfaces/advisors';
import { expect } from '@playwright/test';

pmmTest.describe('Built-in Advisor checks on other databases', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest(
    'PMM-T2616 + PMM-T2626 - Verify every built-in check completes on MySQL 5.7 and a standalone MongoDB 8.2, Verify every MongoDB check completes on a standalone remote MongoDB without a cluster name @advisor-databases',
    async ({ advisorInsightsPage, advisorRunsPage, api, page, remoteDatabasesHelper }) => {
      const { mongodb, mysql57 } = await remoteDatabasesHelper.add({
        mongodb: remoteMongodb('mongo:8.2'),
        // mysql:5.7 has no arm64 image.
        mysql57: remoteMysql('--platform linux/amd64 mysql:5.7'),
      });
      const checks = (await api.advisorsApi.listChecks())
        .filter(
          ({ enabled, technology, user_defined }) =>
            [AdvisorCheckTechnology.mongodb, AdvisorCheckTechnology.mysql].includes(technology) &&
            !user_defined &&
            enabled,
        )
        .map(({ name }) => name);
      const { insightOf, insights, run } = await api.advisorsApi.runChecksAndListInsights(checks, [
        mysql57.serviceId,
        mongodb.serviceId,
      ]);

      await pmmTest.step('No check errors on either database', async () => {
        const errors = insights
          .filter(({ status }) => status === AdvisorCheckResultStatus.error)
          .map(({ check_name, outcome, service_name }) => `${service_name} ${check_name}: ${outcome}`);

        expect(errors).toEqual([]);
        expect(run.services_count).toEqual(2);
        expect(run.checks_count).toEqual(run.planned_checks_count);
      });

      await pmmTest.step('Run history counts every planned check as completed', async () => {
        await page.goto(`${advisorRunsPage.url}?runId=${run.id}`);
        await expect(advisorRunsPage.builders.row(run.id)).toContainText(
          `${run.planned_checks_count}/${run.planned_checks_count}`,
        );
      });

      await pmmTest.step('MongoDB checks pass on the defaults of a standalone MongoDB', async () => {
        const auth = insightOf(mongodb.serviceId, 'mongodb_auth');
        const { builders, elements } = advisorInsightsPage;

        await page.goto(advisorInsightsPage.runUrl(run.id));
        await advisorInsightsPage.selectFilter('serviceName', mongodb.name);
        await advisorInsightsPage.selectFilter('status', 'Error');
        await expect(elements.noData).toBeVisible();
        await advisorInsightsPage.selectFilter('status', 'OK');

        for (const summary of ['MongoDB - Multiple mongod services', 'MongoDB - allocate swap memory']) {
          await expect(builders.rowsWithText(summary)).toHaveCount(1);
        }

        expect(auth.status).toEqual(AdvisorCheckResultStatus.failed);
        await advisorInsightsPage.selectFilter('status', 'Failed');
        await expect(builders.row(auth.id)).toBeVisible();
        await expect(builders.rowsWithText('MongoDB journaling is disabled')).toHaveCount(0);
        await expect(builders.rowsWithText('MongoDB is not using the default log level.')).toHaveCount(0);
      });
    },
  );

  pmmTest(
    'PMM-T2617 - Verify a check reports one finding per database, naming at most 10 relations @advisor-databases',
    async ({ advisorInsightsPage, api, cliHelper, page, remoteDatabasesHelper }) => {
      const { postgresql17 } = await remoteDatabasesHelper.add({
        postgresql17: remotePostgresql('postgres:17'),
      });
      const container = postgresql17.name;
      const psql = (database: string, sql: string) =>
        cliHelper
          .execSilent(`docker exec ${container} psql -U postgres -d ${database} -c "${sql}"`)
          .assertSuccess();

      // No query has used the index of a new relation.
      const createRelations = (database: string, relations: string[]) => {
        psql('postgres', `CREATE DATABASE ${database}`);
        psql(
          database,
          relations.map((name) => `CREATE TABLE ${name} (id int); CREATE INDEX ON ${name} (id);`).join(' '),
        );
      };

      const many = Array.from({ length: 12 }, (_, i) => `qa_relation_${String(i + 1).padStart(2, '0')}`);
      const few = ['qa_relation_a', 'qa_relation_b'];

      createRelations('qa_many', many);
      createRelations('qa_few', few);

      const run = await api.advisorsApi.runChecksAndWait(
        ['postgresql_unused_index_check'],
        [postgresql17.serviceId],
      );
      const insights = await api.advisorsApi.listInsights({ run_id: run.id });

      const findingFor = (database: string) => {
        const insight = insights.find(({ labels }) => labels.database === database);

        expect(insight, `No finding for database ${database}`).toBeDefined();

        return insight as AdvisorInsight;
      };

      await pmmTest.step('Each database gets one finding that counts its relations', async () => {
        expect(insights.map(({ labels }) => labels.database).sort()).toEqual(['qa_few', 'qa_many']);
        expect(findingFor('qa_many').labels.count).toEqual('12');
        expect(findingFor('qa_many').summary).toEqual(
          '12 relation(s) with unused indexes in database qa_many',
        );
        expect(findingFor('qa_few').labels.count).toEqual('2');
      });

      await pmmTest.step('A finding names 10 relations and counts the rest', async () => {
        const { outcome } = findingFor('qa_many');

        expect(many.filter((name) => outcome.includes(name))).toHaveLength(10);
        expect(outcome).toMatch(/; and 2 more\.$/);
        expect(few.every((name) => findingFor('qa_few').outcome.includes(name))).toBe(true);
        expect(findingFor('qa_few').outcome).not.toContain('more');
      });

      await pmmTest.step('Insights shows one row per database', async () => {
        await page.goto(advisorInsightsPage.runUrl(run.id));
        await expect(advisorInsightsPage.elements.rows).toHaveCount(2);
        await expect(advisorInsightsPage.builders.row(findingFor('qa_many').id)).toContainText(
          findingFor('qa_many').summary,
        );
        await advisorInsightsPage.builders.row(findingFor('qa_many').id).dblclick();
        await expect(advisorInsightsPage.builders.detailsField('outcome')).toContainText('; and 2 more.');
      });
    },
  );
});
