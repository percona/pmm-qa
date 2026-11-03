import Api from '@api/api';
import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const remoteServiceName = 'remote_pmm-mysql-integration';
const services = ['pxc_node__', remoteServiceName] as const;
let container: string;

pmmTest.describe.configure({ mode: 'default' });

pmmTest.beforeEach(async ({ cliHelper, grafanaHelper }) => {
  container = cliHelper
    .execSilent("docker ps --filter 'name=^pxc_proxysql_pmm_' --format '{{.Names}}'")
    .assertSuccess()
    .getStdOutLines()[0];

  expect(container, 'pxc_proxysql_pmm docker container should exist').toMatch(/^pxc_proxysql_pmm_/);
  await grafanaHelper.authorize();
});

pmmTest.afterAll(async ({ browser }) => {
  const page = await browser.newPage();

  await new Api(page, page.request).inventoryApi.removeNodesByName([remoteServiceName]);
  await page.close();
});

pmmTest(
  'PMM-T2472 - Verify Adding PXC services remotely @pmm-pxc-integration @not-ui-pipeline',
  async ({ addInstancePage, agentsPage, api, page, servicesPage }) => {
    const { port } = await api.inventoryApi.getServiceDetailsByRegex('^pxc_node__');

    await pmmTest.step('Add the first PXC node as a remote MySQL instance', async () => {
      await page.goto(addInstancePage.url);
      await addInstancePage.builders.instanceType('mysql').click({ timeout: Timeouts.THIRTY_SECONDS });
      await addInstancePage.selectNode('pmm-server');
      await addInstancePage.fillRemoteFields({
        cluster: 'pxc_remote_cluster',
        environment: 'pxc_remote_cluster',
        host: container,
        password: 'admin',
        port: String(port),
        serviceName: remoteServiceName,
        username: 'admin',
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
  'PMM-T2473 - Verify metrics from PXC instances on PMM-Server @pmm-pxc-integration @not-ui-pipeline',
  async ({ api, cliHelper }) => {
    const metric = 'mysql_global_status_max_used_connections';
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('^pxc_node__');

    for (const agent of ['mysqld_exporter', 'mysql_perfschema_agent'] as const) {
      expect(
        cliHelper
          .execSilent(`docker exec ${container} pmm-admin list | grep ${agent} | grep -c Running`)
          .stdout.trim(),
        `Three ${agent} agents must be Running in ${container}`,
      ).toBe('3');
    }

    await api.grafanaApi.waitForMetric(`${metric}{service_name="${service_name}"}`);
    await api.grafanaApi.waitForMetric(`${metric}{service_name="${remoteServiceName}"}`);
  },
);

for (const service of services) {
  pmmTest(
    `PMM-T348 - Verify dashboard after PXC Instances are added @pmm-pxc-integration @not-ui-pipeline | ${service}`,
    async ({ api, dashboard, page, urlHelper }) => {
      const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(`^${service}`);
      const nodeSummary = dashboard.mysql.pxcGaleraNodeSummary;

      await page.goto(
        urlHelper.buildUrlWithParameters(nodeSummary.url, {
          from: 'now-15m',
          refresh: '10s',
          serviceName: service_name,
          to: 'now',
        }),
      );
      await dashboard.verifyAllPanelsHaveData(nodeSummary.noDataMetrics, Timeouts.FIVE_MINUTES);
    },
  );
}

for (const service of services) {
  pmmTest(
    `PMM-T2063 - Verify QAN after PXC Instances is added @pmm-pxc-integration @not-ui-pipeline | ${service}`,
    async ({ api, page, qanStoredMetrics, urlHelper }) => {
      const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(`^${service}`);

      await expect(async () => {
        await page.goto(
          urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-120m', to: 'now' }),
        );
        await qanStoredMetrics.waitForLoad();
        await qanStoredMetrics.selectFilter(
          service_name,
          qanStoredMetrics.builders.filterCheckboxInGroup(service_name, 'Service Name'),
        );
        await qanStoredMetrics.waitForLoad();
        expect(
          await qanStoredMetrics.getQueryCount(),
          `The queries for service ${service_name} instance do NOT exist, check QAN Data`,
        ).toBeGreaterThan(0);
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.TWO_MINUTES });
    },
  );
}
