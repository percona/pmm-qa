import pmmTest from '../../../fixtures/pmmTest';

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

pmmTest(
  'PMM-T1897 - Verify Query Count metric on QAN page for MySQL @pmm-ps-integration',
  async ({ page, cliHelper, credentials, queryAnalytics, urlHelper }) => {
    const containerName = await cliHelper.sendCommand('docker ps -f name=ps --format "{{.Names }}"');
    console.log(`Container name is: ${containerName}`);

    // Prepare data for the test
    await cliHelper.sendCommand(`docker exec ${containerName} mysql -h 127.0.0.1 --port 3306 \
                                  -u ${credentials.perconaServer.ps_84.username} \
                                  -p${credentials.perconaServer.ps_84.password} \
                                  < ./testdata/PMM-T1897.sql`);

    const url = urlHelper.buildUrlWithParameters(queryAnalytics.url, {
      from: 'now-15m',
      database: 'sbtest3',
    });

    await page.goto(url);
    await queryAnalytics.verifyQueryAnalyticsHaveData();
    await queryAnalytics.verifyTotalQueryCount(17);
  },
);
