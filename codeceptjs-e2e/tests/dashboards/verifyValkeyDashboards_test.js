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
    const url = I.buildUrlWithParams(dashboardPage.ValkeyOverviewDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.ValkeyOverviewDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario(
  'PMM-T2087 - Open the Valkey Clients dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.ValkeyClientsDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.ValkeyClientsDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario(
  'PMM-T2087 - Open the Valkey Cluster Details dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.ValkeyClusterDetailsDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.ValkeyClusterDetailsDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario(
  'PMM-T2087 - Open the Valkey Command Detail dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.ValkeyCommandDetailDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.ValkeyCommandDetailDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario('PMM-T2087 - Open the Valkey Load dashboard and verify metrics @nightly @dashboards', async ({ I, dashboardPage }) => {
  const url = I.buildUrlWithParams(dashboardPage.ValkeyLoadDashboard.url, { cluster: valkeyClusterName, from: 'now-5m' });

  I.amOnPage(url);
  dashboardPage.waitForDashboardOpened();
  await dashboardPage.expandEachDashboardRow();
  await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.ValkeyLoadDashboard.metrics);
  await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
});

Scenario('PMM-T2087 - Open the Valkey Memory dashboard and verify metrics @nightly @dashboards', async ({ I, dashboardPage }) => {
  const url = I.buildUrlWithParams(dashboardPage.ValkeyMemoryDashboard.url, {
    cluster: valkeyClusterName,
    from: 'now-5m',
  });

  I.amOnPage(url);
  dashboardPage.waitForDashboardOpened();
  await dashboardPage.expandEachDashboardRow();
  await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.ValkeyMemoryDashboard.metrics);
  await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
});

Scenario(
  'PMM-T2087 - Open the Valkey Network dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.ValkeyNetworkDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.ValkeyNetworkDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario(
  'PMM-T2087 - Open the Valkey Persistence Details dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.ValkeyPersistenceDetailsDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.ValkeyPersistenceDetailsDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario(
  'PMM-T2087 - Open the Valkey Replication dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.ValkeyReplicationDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.ValkeyReplicationDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);

Scenario(
  'PMM-T2087 - Open the Valkey Slowlog dashboard and verify metrics @nightly @dashboards',
  async ({ I, dashboardPage }) => {
    const url = I.buildUrlWithParams(dashboardPage.ValkeySlowlogDashboard.url, {
      cluster: valkeyClusterName,
      from: 'now-5m',
    });

    I.amOnPage(url);
    dashboardPage.waitForDashboardOpened();
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistencePartialMatch(dashboardPage.ValkeySlowlogDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData(0);
  },
);
