import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const remoteServiceName = 'remote_pmm-mysql-integration';
const services = ['ps_pmm_replication_.*_1_', remoteServiceName] as const;
let container: string;

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeEach(async ({ cliHelper, grafanaHelper }) => {
  container = cliHelper
    .execSilent("docker ps --filter 'name=^ps_pmm_replication_.*_1$' --format '{{.Names}}'")
    .assertSuccess()
    .getStdOutLines()[0];

  expect(container, 'ps_pmm_replication source docker container should exist').toMatch(
    /^ps_pmm_replication_.*_1$/,
  );
  await grafanaHelper.authorize();
});

pmmTest.afterAll(async ({ api }) => {
  await api.inventoryApi.removeNodesByName([remoteServiceName]);
});

pmmTest(
  'PMM-T2691 - Verify Adding Mysql services remotely @pmm-ps-integration @not-ui-pipeline',
  async ({ addInstancePage, agentsPage, api, credentials, page, servicesPage }) => {
    const { port } = await api.inventoryApi.getServiceDetailsByRegex(`^${services[0]}`);

    await pmmTest.step('Add the PS replication source as a remote MySQL instance', async () => {
      await page.goto(addInstancePage.url);
      await addInstancePage.builders.instanceType('mysql').click({ timeout: Timeouts.THIRTY_SECONDS });
      await addInstancePage.selectNode('pmm-server');
      await addInstancePage.fillRemoteFields({
        cluster: 'ps_remote_cluster',
        environment: 'ps_remote_cluster',
        host: container,
        password: credentials.perconaServer.ps_84.password,
        port: String(port),
        serviceName: remoteServiceName,
        username: credentials.perconaServer.ps_84.username,
      });
      expect((await addInstancePage.addService()).status()).toEqual(200);
    });

    await expect
      .poll(() => api.inventoryApi.verifyAgentsAreRunning(remoteServiceName), {
        message: `One or more agents are not running for ${remoteServiceName}`,
        timeout: Timeouts.FIVE_MINUTES,
      })
      .toBe(true);
    await expect(servicesPage.builders.serviceRow(remoteServiceName)).toBeVisible({
      timeout: Timeouts.THIRTY_SECONDS,
    });

    const { service_id } = await api.inventoryApi.getServiceDetailsByPartialName(remoteServiceName);

    await page.goto(agentsPage.serviceAgentsUrl(service_id));
    await expect(agentsPage.elements.runningStatuses).toHaveCount(2, { timeout: Timeouts.ONE_MINUTE });
  },
);

pmmTest(
  'PMM-T2692 - Verify metrics from PS instances on PMM-Server @pmm-ps-integration @not-ui-pipeline',
  async ({ api, cliHelper }) => {
    const metric = 'mysql_global_status_max_used_connections';
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(`^${services[0]}`);

    for (const agent of ['mysqld_exporter', 'mysql_perfschema_agent'] as const) {
      expect(
        cliHelper
          .execSilent(`docker exec ${container} pmm-admin list | grep ${agent} | grep -c Running`)
          .stdout.trim(),
        `One ${agent} agent must be Running in ${container}`,
      ).toBe('1');
    }

    await api.grafanaApi.waitForMetric(`${metric}{service_name="${service_name}"}`);
    await api.grafanaApi.waitForMetric(`${metric}{service_name="${remoteServiceName}"}`);
  },
);

for (const service of services) {
  pmmTest(
    `PMM-T317 - Verify dashboard after PS Instances are added @pmm-ps-integration @not-ui-pipeline | ${service}`,
    async ({ api, dashboard, page, urlHelper }) => {
      const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(`^${service}`);
      const instanceSummary = dashboard.mysql.mysqlInstanceSummary;

      for (const metric of [
        'mysql_global_status_uptime',
        'mysql_global_variables_innodb_buffer_pool_size',
      ] as const) {
        await api.prometheusApi.waitForSampleBeforeFiveMinuteBoundary(
          `${metric}{service_name="${service_name}"}`,
        );
      }

      await page.goto(
        urlHelper.buildUrlWithParameters(instanceSummary.url, {
          from: 'now-5m',
          serviceName: service_name,
          to: 'now',
        }),
      );
      await dashboard.verifyMetricsPresent(instanceSummary.metrics);
      await dashboard.verifyAllPanelsHaveData(
        service === remoteServiceName ? instanceSummary.remoteNoDataMetrics : instanceSummary.noDataMetrics,
      );
    },
  );
}

for (const service of services) {
  pmmTest(
    `PMM-T2063 - Verify QAN after PS Instances is added @pmm-ps-integration @not-ui-pipeline | ${service}`,
    async ({ api, qanStoredMetrics, urlHelper }) => {
      const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(`^${service}`);

      await expect(async () => {
        await qanStoredMetrics.openFilteredByService(
          urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-12h', to: 'now' }),
          service_name,
        );
        expect(
          await qanStoredMetrics.getQueryCount(),
          `The queries for service ${service_name} instance do NOT exist, check QAN Data`,
        ).toBeGreaterThan(0);
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
    },
  );
}

pmmTest.describe(() => {
  let primary: string;
  let schemas: string[] = [];

  pmmTest.beforeEach(({ cliHelper }) => {
    primary = cliHelper
      .execSilent("docker ps --filter 'name=^ps_pmm_gr_.*_1$' --format '{{.Names}}'")
      .assertSuccess()
      .getStdOutLines()[0];

    expect(primary, 'ps_pmm_gr primary docker container should exist').toMatch(/^ps_pmm_gr_.*_1$/);
  });

  pmmTest.afterEach(({ cliHelper, credentials }) => {
    if (!primary || !schemas.length) return;

    cliHelper.queryMysql(
      primary,
      credentials.perconaServer.ps_84,
      schemas.map((schema) => `DROP DATABASE IF EXISTS ${schema};`).join(' '),
    );
    schemas = [];
  });

  pmmTest(
    'PMM-T2034 - Verify the same query on different tables for MySQL @pmm-ps-integration',
    async ({ clickHouseHelper, cliHelper, credentials, page, qanStoredMetrics, urlHelper }) => {
      const queryCount = qanStoredMetrics.builders.detailMetricValue('Query Count', 3);

      clickHouseHelper.query('pmm-server', 'TRUNCATE TABLE pmm.metrics');
      schemas = ['testdb1', 'testdb2'];
      cliHelper.queryMysql(
        primary,
        credentials.perconaServer.ps_84,
        `CREATE DATABASE IF NOT EXISTS testdb1; CREATE DATABASE IF NOT EXISTS testdb2;
         DROP TABLE IF EXISTS testdb1.samequery; DROP TABLE IF EXISTS testdb2.samequery;
         CREATE TABLE testdb1.samequery (ID INT NOT NULL, Value INT, PRIMARY KEY (ID));
         CREATE TABLE testdb2.samequery (ID INT NOT NULL, Value INT, PRIMARY KEY (ID));
         USE testdb1; INSERT INTO samequery (ID, Value) VALUES (1, 1); INSERT INTO samequery (ID, Value) VALUES (2, 2);
         USE testdb2; INSERT INTO samequery (ID, Value) VALUES (1, 1); INSERT INTO samequery (ID, Value) VALUES (2, 2);`,
      );

      await expect(async () => {
        await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m' }));
        await qanStoredMetrics.waitForLoad();
        await qanStoredMetrics.searchByValue('samequery');
        await qanStoredMetrics.waitForLoad();
        await qanStoredMetrics.selectRowByQueryStart('insert into');
        await expect(queryCount).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
        await expect(queryCount).toHaveText('4.00');
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });

      const testdb1 = qanStoredMetrics.builders.filterCheckboxInGroup('testdb1', 'Schema');
      const testdb2 = qanStoredMetrics.builders.filterCheckboxInGroup('testdb2', 'Schema');

      await qanStoredMetrics.selectFilter('testdb1', testdb1);
      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.selectRowByQueryStart('insert into');
      await expect(queryCount).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(queryCount).toHaveText('2.00');

      await qanStoredMetrics.selectFilter('testdb1', testdb1);
      await qanStoredMetrics.selectFilter('testdb2', testdb2);
      await qanStoredMetrics.waitForLoad();
      await qanStoredMetrics.selectRowByQueryStart('insert into');
      await expect(queryCount).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      await expect(queryCount).toHaveText('2.00');
    },
  );

  pmmTest(
    'PMM-T2040 - Verify there is no error while clicking on Table or Examples or Explain @pmm-ps-integration',
    async ({ clickHouseHelper, cliHelper, credentials, page, qanStoredMetrics, urlHelper }) => {
      clickHouseHelper.query('pmm-server', 'TRUNCATE TABLE pmm.metrics');
      schemas = ['dbT2040'];
      cliHelper.queryMysql(
        primary,
        credentials.perconaServer.ps_84,
        `CREATE DATABASE IF NOT EXISTS dbT2040; USE dbT2040; DROP TABLE IF EXISTS tabletodelete;
         CREATE TABLE IF NOT EXISTS tabletodelete (ID INT NOT NULL, Value INT, PRIMARY KEY (ID));
         INSERT INTO tabletodelete (ID, Value) VALUES (1, 1); SELECT ID, Value FROM tabletodelete WHERE ID = 1;`,
      );

      await expect(async () => {
        await page.goto(urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-5m' }));
        await qanStoredMetrics.waitForLoad();
        await qanStoredMetrics.searchByValue('tabletodelete');
        await qanStoredMetrics.waitForLoad();
        await expect(qanStoredMetrics.builders.workloadRowStartingWith('select')).toBeVisible({
          timeout: Timeouts.THIRTY_SECONDS,
        });
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });

      cliHelper.queryMysql(
        primary,
        credentials.perconaServer.ps_84,
        'DROP TABLE IF EXISTS dbT2040.tabletodelete',
      );
      await qanStoredMetrics.selectRowByQueryStart('select');
      await expect(qanStoredMetrics.messages.notification).toBeHidden();

      for (const tab of ['Examples', 'Explain', 'Tables'] as const) {
        await qanStoredMetrics.openDetailsTab(tab);
        await expect(qanStoredMetrics.messages.notification).toBeHidden();
      }
    },
  );
});
