import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';

pmmTest.beforeAll(async ({ cliHelper, credentials }) => {
  const containerName = cliHelper.execSilent(
    'docker ps --filter \'name=(ps|mysql)\' --format "{{.Names }}" | head -n 1',
  ).stdout;
  const result = cliHelper.execSilent(`docker exec -i ${containerName} mysql -h 127.0.0.1 --port 3306 \
                                                          -u ${credentials.perconaServer.ps_84.username} \
                                                          -p${credentials.perconaServer.ps_84.password} \
                                                          < \${PWD}/testdata/PMM-T1897.sql`);

  if (result.code != 0) {
    throw new Error(`Exec command failed with code ${result.code} and message ${result.stderr}`);
  }
});

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2030 - Verify QAN for PS Replica Instance @nightly @pmm-ps-integration',
  async ({ api, page, qanStoredMetrics, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex('ps_pmm_replication_.*_2');

    await page.goto(
      urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
        from: 'now-15m',
        schema: 'sbtest',
        serviceName: service_name,
      }),
    );
    await qanStoredMetrics.verifyQanStoredMetricsHaveData();
  },
);

pmmTest(
  'PMM-T1897 - Verify Query Count metric on QAN page for MySQL @pmm-ps-integration',
  async ({ page, qanStoredMetrics, urlHelper }) => {
    const url = urlHelper.buildUrlWithParameters(qanStoredMetrics.url, {
      refresh: '5s',
      schema: 'sbtest3',
    });

    await page.goto(url);
    await qanStoredMetrics.waitForQanStoredMetricsToHaveData(Timeouts.TWO_MINUTES);
    await qanStoredMetrics.verifyTotalQueryCount(19);
  },
);
