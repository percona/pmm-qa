import pmmTest from '../fixtures/pmmTest';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2030 - Verify QAN for Percona Server Instance @nightly @pmm-ps-integration',
  async ({ page, queryAnalytics, urlHelper, inventoryApi }) => {
    const service = await inventoryApi.getServiceDetailsByPartialName('ps_pmm');
    const url = urlHelper.buildUrlWithParameters(queryAnalytics.url, {
      from: 'now-15m',
      serviceName: service.service_name,
    });

    await page.goto(url);
    await queryAnalytics.verifyQueryAnalyticsHaveData();
  },
);
