import pmmTest from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeAll(async ({ cliHelper, credentials }) => {
  const containerName = cliHelper.execSilent('docker ps --filter \'name=(ps|mysql)\' --format "{{.Names }}"');
  cliHelper.execSilent(`docker exec -i ${containerName.stdout} mysql -h 127.0.0.1 --port 3306 \
                                      -u ${credentials.perconaServer.ps_84.username} \
                                      -p${credentials.perconaServer.ps_84.password} \
                                      < \${PWD}/testdata/PMM-T1897.sql`);
});

pmmTest(
  'PMM-T2030 - Verify QAN for Percona Server Instance @nightly @pmm-ps-integration',
  async ({ queryAnalytics, api }) => {
    const serviceList = await api.inventoryApi.getServicesByType(ServiceType.mysql);
    const serviceName = serviceList[0].service_name;
    await queryAnalytics.open(queryAnalytics.url, { from: 'now-15m', serviceName });
    await queryAnalytics.verifyQueryAnalyticsHaveData();
  },
);

pmmTest(
  'PMM-T1897 - Verify Query Count metric on QAN page for MySQL @pmm-ps-integration',
  async ({ queryAnalytics }) => {
    await queryAnalytics.open(queryAnalytics.url, { schema: 'sbtest3', refresh: '5s' });
    await queryAnalytics.waitForQueryAnalyticsToHaveData(Timeouts.TWO_MINUTES);
    await queryAnalytics.verifyTotalQueryCount(20);
  },
);
