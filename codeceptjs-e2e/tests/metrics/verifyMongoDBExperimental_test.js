const assert = require('assert');
const {
  SERVICE_TYPE,
  gssapi,
} = require('../helper/constants');

Feature('MongoDB Experimental Dashboards tests');

let mongodb_service_name_ac;
const containerName = 'rs101';

BeforeSuite(async ({ I, inventoryAPI }) => {
  const serviceNamePrefix = gssapi.enabled === 'true' ? 'rs101_gssapi' : 'rs101';
  const mongoService = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.MONGODB, serviceNamePrefix);

  mongodb_service_name_ac = mongoService.service_name;

  // check that rs101 docker container exists
  const dockerCheck = await I.verifyCommand(`docker ps | grep ${containerName}`);

  assert.ok(dockerCheck.includes(containerName), 'rs101 docker container should exist. please run pmm-framework with --database psmdb');
});

Before(async ({ I }) => {
  await I.Authorize();
});

// TODO: update the test to use new Cluster Summary dashboard https://github.com/percona/grafana-dashboards/pull/1611
Scenario.skip(
  'PMM-T1332 - Verify MongoDB - MongoDB Collection Details @mongodb-exporter',
  async ({
    I, dashboardPage,
  }) => {
    I.amOnPage(I.buildUrlWithParams(dashboardPage.mongoDbCollectionDetails.clearUrl, { from: 'now-5m', service_name: mongodb_service_name_ac }));
    dashboardPage.waitForDashboardOpened();
    I.seeTextEquals('The next two graphs are available only when --enable-all-collectors option is used in pmm-admin. Graph Top 5 Collection by Documents Changed displays data only on selecting the Primary node.', locate('$TextPanel-converted-content').as('Explanation text field'));
    await dashboardPage.verifyMetricsExistence(dashboardPage.mongoDbCollectionDetails.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(2);
  },
);

Scenario(
  'PMM-T1334 - Verify MongoDB - MongoDB Oplog Details @mongodb-exporter',
  async ({
    I, dashboardPage,
  }) => {
    I.amOnPage(I.buildUrlWithParams(dashboardPage.mongoDbOplogDetails.clearUrl, { from: 'now-5m', service_name: mongodb_service_name_ac }));
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.verifyMetricsExistence(dashboardPage.mongoDbOplogDetails.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(2);
  },
);
