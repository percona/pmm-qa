import Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
import CliHelper from '@helpers/cli.helper';
import { Timeouts } from '@helpers/timeouts';
import { AdvisorCheckResultStatus, AdvisorInsight } from '@interfaces/advisors';
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
const containers: string[] = [];
const nodeIds: string[] = [];

// pmm-framework sets up neither a standalone MongoDB nor MongoDB 8.2, so the tests start their own
// databases, which PMM Server's own agent monitors over the pmm-qa network.
const monitorDatabase = async (api: Api, cliHelper: CliHelper, database: Database) => {
  const name = `qa-advisors-${database.type}-${Date.now()}`;

  containers.push(name);
  cliHelper
    .execute(`docker run --detach --quiet --name ${name} --network pmm-qa ${database.dockerArgs}`)
    .assertSuccess();

  let service = { node_id: '', service_id: '' };

  // The database accepts connections only once it has initialized, and PMM connects to it before adding it.
  await expect(async () => {
    const response = await api.managementApi.addService({
      [database.type]: {
        add_node: { node_name: name, node_type: 'NODE_TYPE_REMOTE_NODE' },
        address: name,
        pmm_agent_id: 'pmm-server',
        port: database.port,
        service_name: name,
        ...database.credentials,
      },
    });

    service = response[database.type]?.service ?? service;
  }).toPass({ intervals: [5_000], timeout: Timeouts.TWO_MINUTES });
  nodeIds.push(service.node_id);

  return { container: name, serviceId: service.service_id };
};

pmmTest.describe('Built-in Advisor checks on other databases', () => {
  pmmTest.beforeEach(async ({ grafanaHelper }) => {
    await grafanaHelper.authorize();
  });

  pmmTest.afterEach(async ({ api, cliHelper }) => {
    for (const nodeId of nodeIds.splice(0)) await api.inventoryApi.deleteNode(nodeId, true);
    for (const container of containers.splice(0)) cliHelper.removeContainer(container);
  });

  pmmTest(
    'PMM-Txxxx - Verify every built-in check completes on MySQL 5.7 and a standalone MongoDB 8.2 @advisor-databases',
    async ({ advisorRunsPage, api, cliHelper, page }) => {
      const mysql = await monitorDatabase(api, cliHelper, databases.mysql57);
      const mongodb = await monitorDatabase(api, cliHelper, databases.mongodb82);
      const run = await api.advisorsApi.runChecksAndWait(
        [],
        [mysql.serviceId, mongodb.serviceId],
        Timeouts.FIVE_MINUTES,
      );

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
      const postgresql = await monitorDatabase(api, cliHelper, databases.postgresql17);
      const psql = (database: string, sql: string) =>
        cliHelper
          .execSilent(`docker exec ${postgresql.container} psql -U postgres -d ${database} -c "${sql}"`)
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
        [postgresql.serviceId],
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
