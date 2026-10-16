import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { Timeouts } from '@helpers/timeouts';

const psContainerCommand = "docker ps --format '{{.Names}}' | grep ps_pmm | head -1";
let serviceId = '';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest.afterEach(async ({ api }) => {
  if (serviceId) await api.managementApi.removeService(serviceId);

  serviceId = '';
});

pmmTest(
  'PMM-T2397 - Verify a MySQL service added with pmm-admin from an external client is Up and its dashboard shows data on PMM HA @pmm-ha',
  async ({ api, cliHelper, credentials, dashboard, page, qanStoredMetrics, servicesPage, urlHelper }) => {
    const serviceName = `ha-ext-mysql-${Date.now()}`;
    // Needs the pmm-framework `--database ps` client on the runner: its pmm-agent sits outside the
    // cluster and reaches PMM through HAProxy, the write path PMM-14678 broke.
    const psContainer = cliHelper.execute(psContainerCommand).assertSuccess().stdout.trim();

    expect(
      psContainer,
      'No ps_pmm container on the runner; run with setup_services "--database ps"',
    ).not.toEqual('');

    await pmmTest.step(`Add "${serviceName}" with pmm-admin from the external client`, async () => {
      cliHelper
        .execute(
          `docker exec ${psContainer} pmm-admin add mysql --query-source=perfschema --username=${credentials.perconaServer.username} --password=${credentials.perconaServer.password} ${serviceName} 127.0.0.1:3306`,
        )
        .assertSuccess();
      serviceId = (await api.inventoryApi.getServiceDetailsByRegex(`^${serviceName}$`)).service_id;
    });

    await pmmTest.step(`Verify "${serviceName}" metrics reach VictoriaMetrics`, async () => {
      await expect(async () => {
        expect(
          await api.prometheusApi.instantQueryValue(`mysql_up{service_name="${serviceName}"}`),
          `mysql_up for "${serviceName}" must be written by the external vmagent`,
        ).toEqual(1);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });

    await pmmTest.step(`Verify "${serviceName}" is Up on the Inventory page`, async () => {
      await page.goto(servicesPage.url);
      await expect(servicesPage.builders.statusByServiceName(serviceName)).toHaveText('Up', {
        timeout: Timeouts.FIVE_MINUTES,
      });
    });

    await pmmTest.step(
      `Verify the MySQL Instance Summary dashboard has data for "${serviceName}"`,
      async () => {
        await page.goto(
          urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceSummary.url, {
            from: 'now-15m',
            serviceName,
          }),
        );
        await dashboard.verifyAllPanelsHaveData(
          dashboard.mysql.mysqlInstanceSummary.noDataMetrics,
          Timeouts.FIVE_MINUTES,
        );
      },
    );

    await pmmTest.step(`Verify Query Analytics lists queries for "${serviceName}"`, async () => {
      await expect(async () => {
        await page.goto(
          urlHelper.buildUrlWithParameters(qanStoredMetrics.url, { from: 'now-15m', serviceName, to: 'now' }),
        );
        await expect(qanStoredMetrics.builders.queryRow(1)).toBeVisible({ timeout: Timeouts.THIRTY_SECONDS });
      }).toPass({ intervals: [Timeouts.TEN_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });
  },
);
