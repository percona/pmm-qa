import { rdsPort } from '@api/management.api';
import pmmTest from '@fixtures/pmmTest';
import MySQLHelper from '@helpers/mysql.helper';
import { rdsInstanceId } from '@helpers/serviceRds.helper';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

const serviceName = `rta-rds-${Date.now()}`;
let rds: MySQLHelper | undefined;

pmmTest.afterEach(async ({ api }) => {
  await api.realTimeAnalyticsApi.stopAllSessions();
  await rds?.close();
  // addRds names the node after the service; deleting it removes the service and agents too.
  await api.inventoryApi.removeNodesByName([serviceName]);
});

pmmTest(
  'PMM-T2888 - Verify Real-Time Analytics shows running statements of an Amazon RDS for MySQL service @instances',
  async ({ api, credentials, grafanaHelper, page, queryAnalytics }) => {
    const { address, password, username } = credentials.rdsMysql84;
    const { rta } = queryAnalytics;
    const queryLabel = 'rta-rds';

    rds = new MySQLHelper({ host: address, password, port: rdsPort, username });
    await grafanaHelper.authorize();

    const { service_id: serviceId } = (
      await api.managementApi.addRds({
        address,
        awsAccessKey: credentials.aws.accessKey,
        awsSecretKey: credentials.aws.secretKey,
        instanceId: rdsInstanceId(address),
        password,
        serviceName,
        username,
      })
    ).rds.mysql;

    await pmmTest.step('Start Real-Time Analytics for the RDS service', async () => {
      await api.realTimeAnalyticsApi.startRealTimeAnalytics(serviceId);
      await page.goto(rta.getUrlWithServices([serviceId]));
    });

    await pmmTest.step('Verify a running statement on RDS is listed with the RDS host', async () => {
      void rds?.simulateLongRunningQuery({ delayMs: Timeouts.THIRTY_SECONDS, queryLabel });
      await rta.setQueryTextFilter(queryLabel);

      await expect(rta.builders.rowByQueryText(queryLabel)).toBeVisible({ timeout: Timeouts.TEN_SECONDS });
      await expect(rta.builders.hostForQueryByText(queryLabel)).toHaveText(serviceName);
    });
  },
);
