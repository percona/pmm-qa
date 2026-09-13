import pmmTest from '@fixtures/pmmTest';
import { expect } from '@playwright/test';
import { HaNodeRole } from '@interfaces/ha';
import { Timeouts } from '@helpers/timeouts';
import { defaultReplicas } from '@helpers/haCluster.helper';

let serviceId = '';

pmmTest.beforeEach(async ({ api, grafanaHelper, haClusterHelper }) => {
  await grafanaHelper.authorize();
  await haClusterHelper.ensureServing(api.haApi);
});

pmmTest.afterEach(async ({ api }) => {
  if (serviceId) await api.managementApi.removeService(serviceId);
});

pmmTest(
  'PMM-T2105 - Verify RDS inventory and dashboards after failover @pmm-ha',
  async ({ api, credentials, dashboard, haClusterHelper, page, servicesPage, urlHelper }) => {
    const serviceName = `ha-rds-mysql-${Date.now()}`;
    const summaryUrl = urlHelper.buildUrlWithParameters(dashboard.mysql.mysqlInstanceSummary.url, {
      from: 'now-15m',
      serviceName,
    });

    serviceId = (
      await api.managementApi.addRds({
        address: credentials.rdsMysql84.address,
        awsAccessKey: credentials.aws.accessKey,
        awsSecretKey: credentials.aws.secretKey,
        instanceId: serviceName,
        password: credentials.rdsMysql84.password,
        serviceName,
        username: credentials.rdsMysql84.username,
      })
    ).rds.mysql.service_id;

    const baselineNoDataPanels = await pmmTest.step(
      `Verify "${serviceName}" is Up on the Inventory page and its summary has data`,
      async () => {
        await page.goto(servicesPage.url);
        await expect(servicesPage.builders.statusByServiceName(serviceName)).toHaveText('Up', {
          timeout: Timeouts.FIVE_MINUTES,
        });

        await page.goto(summaryUrl);
        await dashboard.loadAllPanels();

        return await dashboard.collectTextsAcrossScroll(dashboard.elements.noDataPanelName);
      },
    );

    await pmmTest.step('Restart the leader pod and check the new leader pod', async () => {
      const newLeader = await haClusterHelper.failoverLeader(api.haApi);

      await expect(async () => {
        const nodes = await api.haApi.getNodes();

        expect(nodes.filter((node) => node.role === HaNodeRole.leader).map((node) => node.node_name)).toEqual(
          [newLeader],
        );
        expect(nodes.filter((node) => node.status === 'alive')).toHaveLength(defaultReplicas);
      }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });
    });

    const failoverAt = await api.prometheusApi.waitForServerTime();

    await pmmTest.step(
      `Verify "${serviceName}" is still Up and still collected after the failover`,
      async () => {
        await expect(async () => {
          await page.goto(servicesPage.url);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

        await expect(servicesPage.builders.statusByServiceName(serviceName)).toHaveText('Up', {
          timeout: Timeouts.FIVE_MINUTES,
        });

        await expect(async () => {
          expect(
            await api.prometheusApi.instantQueryValue(
              `min(timestamp(mysql_up{service_name="${serviceName}"}))`,
            ),
            `"${serviceName}" must be scraped again after the failover`,
          ).toBeGreaterThan(failoverAt);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.FIVE_MINUTES });

        await expect(async () => {
          await page.goto(summaryUrl);
        }).toPass({ intervals: [Timeouts.FIVE_SECONDS], timeout: Timeouts.TWO_MINUTES });

        await dashboard.verifyAllPanelsHaveData(baselineNoDataPanels);
      },
    );
  },
);
