import pmmTest from '../../../fixtures/pmmTest';
import { ServiceType } from '../../../intefaces/inventory';
import { Timeouts } from '../../../helpers/timeouts';

pmmTest.beforeAll(async ({ cliHelper, credentials }) => {
  const containerName = await cliHelper.sendCommand(
    'docker ps --filter \'name=(ps|mysql)\' --format "{{.Names }}"',
  );

  await cliHelper.sendCommand(`docker exec -i ${containerName} mysql -h 127.0.0.1 --port 3306 \
                                      -u ${credentials.perconaServer.ps_84.username} \
                                      -p${credentials.perconaServer.ps_84.password} \
                                      < \${PWD}/testdata/PMM-T1897.sql`);
});

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2030 - Verify QAN for Percona Server Instance @nightly @pmm-ps-integration',
  async ({ page, queryAnalytics, urlHelper, inventoryApi }) => {
    const serviceList = await inventoryApi.getServicesByType(ServiceType.mysql);

    await page.goto(
      urlHelper.buildUrlWithParameters(queryAnalytics.url, {
        from: 'now-15m',
        serviceName: serviceList[0].service_name,
      }),
    );
    await queryAnalytics.verifyQueryAnalyticsHaveData();
  },
);

pmmTest(
  'PMM-T1897 - Verify Query Count metric on QAN page for MySQL @pmm-ps-integration',
  async ({ page, queryAnalytics, urlHelper }) => {
    await page.waitForTimeout(Timeouts.ONE_MINUTE);
    const url = urlHelper.buildUrlWithParameters(queryAnalytics.url, {
      from: 'now-15m',
      database: 'sbtest3',
      refresh: '5s',
    });

    await page.goto(url);
    await queryAnalytics.verifyQueryAnalyticsHaveData();
    await queryAnalytics.verifyTotalQueryCount(17);
  },
);
