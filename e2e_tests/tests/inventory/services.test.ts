import pmmTest from '@fixtures/pmmTest';
import { ServiceType } from '@interfaces/inventory';
import { expect } from '@playwright/test';

pmmTest.beforeEach(async ({ grafanaHelper, page, servicesPage }) => {
  await grafanaHelper.authorize();
  await page.goto(servicesPage.url);
});

pmmTest(
  'PMM-T2159 - Verify MongoDB RTA Agent displayed in Inventory UI @rta',
  async ({ agentsPage, api, servicesPage }) => {
    const service = await api.inventoryApi.getServiceDetailsByRegex('^rs101_');

    await api.realTimeAnalyticsApi.startRealTimeAnalytics(service.service_id);
    await servicesPage.builders.monitoringStatusByServiceName(service.service_name).click();
    // TODO: Remove reload after story: https://perconadev.atlassian.net/browse/PMM-14828 is fixed.
    await agentsPage.verifyRTAAgentStatus('Running');

    await api.realTimeAnalyticsApi.stopRealTimeAnalytics(service.service_id);
    await agentsPage.verifyRTAAgentStatus('Done');
  },
);

pmmTest(
  'PMM-T2463 - Verify the export contains only filtered or selected services @inventory',
  async ({ api, page, servicesPage }) => {
    const mongoServices = await api.inventoryApi.getServicesByType(ServiceType.mongodb);
    const mongoNames = mongoServices.map(({ service_name }) => service_name).sort();
    const [cluster] = mongoServices.map((service) => service.cluster);
    // The members share a name prefix, rs101_, rs102_ and rs103_ from pmm-framework
    const mongoPrefix = mongoNames.reduce((prefix, name) => {
      while (!name.startsWith(prefix)) prefix = prefix.slice(0, -1);

      return prefix;
    });
    const mysqlName = (await api.inventoryApi.getServicesByType(ServiceType.mysql))[0].service_name;
    const exportedNames = async () =>
      (await servicesPage.exportServices()).map(({ service_name }) => service_name).sort();

    expect(mongoNames, 'A replica set of three MongoDB members').toHaveLength(3);
    expect(new Set(mongoServices.map((service) => service.cluster))).toEqual(new Set([cluster]));
    expect(mongoPrefix, 'The MongoDB members share a name prefix').not.toBe('');

    await pmmTest.step('Filter the MongoDB members and export them', async () => {
      // The table has no service type filter, so the members are filtered by their shared name
      await servicesPage.filterByServiceName(mongoPrefix);
      await expect(servicesPage.elements.serviceRows).toHaveCount(3);
      expect(await exportedNames()).toEqual(mongoNames);
    });

    await pmmTest.step('Organize by clusters, collapse the cluster and export', async () => {
      await servicesPage.buttons.organizeByClusters.check();
      await expect(servicesPage.builders.serviceRow(mongoNames[0])).toBeVisible();
      await servicesPage.builders.expandRowButton(cluster).click();
      await expect(servicesPage.builders.serviceRow(cluster)).toBeVisible();
      await expect(servicesPage.builders.serviceRow(mongoNames[0])).toBeHidden();
      expect(await exportedNames()).toEqual(mongoNames);
    });

    await pmmTest.step('Clear the filter, select MySQL and one MongoDB member and export', async () => {
      await servicesPage.buttons.organizeByClusters.uncheck();
      await servicesPage.inputs.serviceNameFilter.clear();
      await servicesPage.pagination.showAllRows();
      await servicesPage.builders.selectServiceCheckbox(mysqlName).check();
      await servicesPage.builders.selectServiceCheckbox(mongoNames[0]).check();
      expect(await exportedNames()).toEqual([mysqlName, mongoNames[0]].sort());
    });

    await pmmTest.step('Filter by a name no service has', async () => {
      // A selection hidden by the filter still drives Export (PMM-15002), so start without one
      await page.reload();
      await expect(servicesPage.pagination.selectedRowCheckboxes).toHaveCount(0);
      await servicesPage.filterByServiceName('no-such-service');
      await expect(servicesPage.elements.serviceRows).toHaveCount(0);
      await expect(servicesPage.buttons.export).toBeDisabled();
    });
  },
);
