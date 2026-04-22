const { dashboardPage } = inject();
const assert = require('assert');
const { SERVICE_TYPE } = require('../helper/constants');

const { inventoryAPI } = inject();
let valkeyClusterName;

Feature('Valkey Dashboards').retry(1);

BeforeSuite(async () => {
  const response = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.VALKEY, 'valkey');

  valkeyClusterName = response.cluster;
  assert.ok(valkeyClusterName, 'Valkey cluster name was not resolved in BeforeSuite');
});

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T2087 - Open the Valkey Overview dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.valkeyOverviewDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.valkeyOverviewDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario(
  'PMM-T2087 - Open the Valkey Clients dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.valkeyClientsDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.valkeyClientsDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario(
  'PMM-T2087 - Open the Valkey Cluster Details dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.valkeyClusterDetailsDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.valkeyClusterDetailsDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario(
  'PMM-T2087 - Open the Valkey Command Detail dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.valkeyCommandDetailDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.valkeyCommandDetailDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario('PMM-T2087 - Open the Valkey Load dashboard and verify metrics @nightly @dashboards', async ({ I, dashboardPage }) => {
  const url = I.buildUrlWithParams(dashboardPage.valkeyLoadDashboard.url, { cluster: valkeyClusterName, from: 'now-5m' });

  I.amOnPage(url);
  dashboardPage.waitForDashboardOpened();
  await dashboardPage.expandEachDashboardRow();
  await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.valkeyLoadDashboard.metrics);
  await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
});

Scenario('PMM-T2087 - Open the Valkey Memory dashboard and verify metrics @nightly @dashboards', async ({ I, dashboardPage }) => {
  const url = I.buildUrlWithParams(dashboardPage.valkeyMemoryDashboard.url, {
    cluster: valkeyClusterName,
    from: 'now-5m',
  });

  I.amOnPage(url);
  dashboardPage.waitForDashboardOpened();
  await dashboardPage.expandEachDashboardRow();
  await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.valkeyMemoryDashboard.metrics);
  await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
});

Scenario(
  'PMM-T2087 - Open the Valkey Network dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.valkeyNetworkDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.valkeyNetworkDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario(
  'PMM-T2087 - Open the Valkey Persistence Details dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.valkeyPersistenceDetailsDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.valkeyPersistenceDetailsDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario(
  'PMM-T2087 - Open the Valkey Replication dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.valkeyReplicationDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.valkeyReplicationDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario(
  'PMM-T2087 - Open the Valkey Slowlog dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.valkeySlowlogDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.valkeySlowlogDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);
