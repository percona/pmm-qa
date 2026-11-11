import pmmTest from '@fixtures/pmmTest';
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

const databases = {
  mongodb82: { dockerArgs: 'mongo:8.2', port: 27_017, type: 'mongodb' },
  mysql57: {
    credentials: { password: 'qa-advisors', username: 'root' },
    // mysql:5.7 has no arm64 image.
    dockerArgs: '--platform linux/amd64 -e MYSQL_ROOT_PASSWORD=qa-advisors mysql:5.7',
    port: 3_306,
    type: 'mysql',
  },
  postgresql17: {
    credentials: { password: 'qa-advisors', username: 'postgres' },
    dockerArgs: '-e POSTGRES_PASSWORD=qa-advisors postgres:17',
    port: 5_432,
    type: 'postgresql',
  },
} satisfies Record<string, Database>;
// Both error on a standalone MongoDB on main as well, so the run leaves them out until PMM-15706 fixes them:
// one expects a cluster name, the other a swap metric.
const brokenChecks = ['mongodb_multiple_services', 'mongodb_swap_allocation'];
const containers: string[] = [];
const nodeIds: string[] = [];

pmmTest.describe('Built-in Advisor checks on other databases', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest.afterEach(async ({ api, cliHelper }) => {
    for (const container of containers.splice(0)) cliHelper.removeContainer(container);
    for (const nodeId of nodeIds.splice(0)) await api.inventoryApi.deleteNode(nodeId, true);
  });

  pmmTest(
    'PMM-Txxxx - Verify every built-in check completes on MySQL 5.7 and a standalone MongoDB 8.2 @advisor-databases',
    async ({ advisorRunsPage, api, cliHelper, page }) => {
      const serviceIds: string[] = [];

      for (const database of [databases.mysql57, databases.mongodb82] as Database[]) {
        const name = `qa-advisors-${database.type}-${Date.now()}`;

        containers.push(name);
        cliHelper.startContainer(name, database.dockerArgs);

        const service = await api.managementApi.addRemoteDatabase(
          database.type,
          name,
          database.port,
          database.credentials,
        );

        nodeIds.push(service.node_id);
        serviceIds.push(service.service_id);
      }

      const checks = (await api.advisorsApi.listChecks())
        .filter(
          ({ enabled, name, technology, user_defined }) =>
            [AdvisorCheckTechnology.mongodb, AdvisorCheckTechnology.mysql].includes(technology) &&
            !user_defined &&
            enabled &&
            !brokenChecks.includes(name),
        )
        .map(({ name }) => name);
      const run = await api.advisorsApi.runChecksAndWait(checks, serviceIds, Timeouts.FIVE_MINUTES);

      await pmmTest.step('No check errors on either database', async () => {
        const errors = (await api.advisorsApi.listInsights({ page_size: '500', run_id: run.id }))
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
    },
  );

  pmmTest(
    'PMM-Txxxx - Verify a check reports one finding per database, naming at most 10 relations @advisor-databases',
    async ({ advisorInsightsPage, api, cliHelper, page }) => {
      const { credentials, dockerArgs, port, type } = databases.postgresql17;
      const container = `qa-advisors-${type}-${Date.now()}`;

      containers.push(container);
      cliHelper.startContainer(container, dockerArgs);

      const postgresql = await api.managementApi.addRemoteDatabase(type, container, port, credentials);

      nodeIds.push(postgresql.node_id);

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
        [postgresql.service_id],
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
