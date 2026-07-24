const assert = require('assert');
const { SERVICE_TYPE } = require('../helper/constants');

Feature('PMM + PDPGSQL Integration Scenarios');

Before(async ({ I }) => {
  await I.Authorize();
});

Scenario(
  'PMM-T1262 - Verify Postgresql Dashboard Instance Summary has Data @not-ui-pipeline @pdpgsql-pmm-integration',
  async ({
    I, dashboardPage, adminPage, inventoryAPI,
  }) => {
    const pgsm_service = await inventoryAPI.apiGetNodeInfoByServiceName(SERVICE_TYPE.POSTGRESQL, 'pdpgsql_');

    I.amOnPage(I.buildUrlWithParams(dashboardPage.postgresqlInstanceSummaryDashboard.url, {
      service_name: pgsm_service.service_name,
      from: 'now-5m',
    }));
    await dashboardPage.waitForDashboardOpened();

    I.wait(60);
    await dashboardPage.expandEachDashboardRow();
    await dashboardPage.verifyMetricsExistence(dashboardPage.postgresqlInstanceSummaryDashboard.metrics);
    await dashboardPage.verifyThereAreNoGraphsWithoutData();

    const dockerCheck = await I.verifyCommand('docker ps | grep pdpgsql_ | awk \'{print $NF}\'');

    const container_name = dockerCheck.trim();

    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "postgresql_pgstatmonitor_agent" | grep "Running"`);
    await I.verifyCommand(`docker exec ${container_name} pmm-admin list | grep "postgres_exporter" | grep "Running"`);
  },
).retry(3);
