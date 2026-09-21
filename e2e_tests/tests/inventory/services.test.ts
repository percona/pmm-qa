import pmmTest from '@fixtures/pmmTest';

pmmTest.beforeEach(async ({ grafanaHelper, page, servicesPage }) => {
  await grafanaHelper.authorize();
  await page.goto(servicesPage.url);
});

pmmTest(
  'PMM-T2159 - Verify MongoDB RTA Agent displayed in Inventory UI @rta',
  async ({ agentsPage, api, servicesPage }) => {
    const service = await api.inventoryApi.getServiceDetailsByPartialName('rs101');

    await api.realTimeAnalyticsApi.startRealTimeAnalytics(service.service_id);
    await servicesPage.builders.monitoringStatusByServiceName(service.service_name).click();
    // TODO: Remove reload after story: https://perconadev.atlassian.net/browse/PMM-14828 is fixed.
    await agentsPage.verifyRTAAgentStatus('Running');

    await api.realTimeAnalyticsApi.stopRealTimeAnalytics(service.service_id);
    await agentsPage.verifyRTAAgentStatus('Done');
  },
);
