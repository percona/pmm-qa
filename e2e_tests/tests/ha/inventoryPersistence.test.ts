import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const mysqlServiceRegex = 'ps_pmm|mysql_pmm';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest(
  'PMM-T2105 - Verify inventory and dashboards after failover @pmm-ha',
  async ({ api, dashboard, haClusterHelper, page, servicesPage, urlHelper }) => {
    const { service_name } = await api.inventoryApi.getServiceDetailsByRegex(mysqlServiceRegex);
    const summaryUrl = urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceSummary.url, {
      from: 'now-15m',
      serviceName: service_name,
    });

    await pmmTest.step(
      `Verify "${service_name}" is Up on the Inventory page and its summary has data`,
      async () => {
        await page.goto(servicesPage.url);
        await expect(servicesPage.builders.monitoringStatusByServiceName(service_name)).toHaveText('OK', {
          timeout: Timeouts.ONE_MINUTE,
        });

        await page.goto(summaryUrl);
        await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlInstanceSummary.noDataMetrics);
      },
    );

    const failoverAt = await pmmTest.step('Restart the leader pod', async () => {
      await haClusterHelper.failoverLeader(api.haApi);

      return await api.prometheusApi.waitForServerTime();
    });

    await pmmTest.step(
      `Verify "${service_name}" is still Up and still collected after the failover`,
      async () => {
        await expect(async () => {
          await page.goto(servicesPage.url);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

        await expect(servicesPage.builders.monitoringStatusByServiceName(service_name)).toHaveText('OK', {
          timeout: Timeouts.TWO_MINUTES,
        });

        await expect(async () => {
          expect(
            await api.prometheusApi.instantQueryValue(
              `min(timestamp(mysql_up{service_name="${service_name}"}))`,
            ),
            `"${service_name}" must be scraped again after the failover`,
          ).toBeGreaterThan(failoverAt);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });

        await expect(async () => {
          await page.goto(summaryUrl);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

        await dashboard.verifyAllPanelsHaveData(dashboard.mysql.mysqlInstanceSummary.noDataMetrics);
      },
    );
  },
);
