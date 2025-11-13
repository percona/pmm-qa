import pmmTest from '@fixtures/pmmTest';
import { AgentStatus, ServiceType } from '@interfaces/inventory';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2095 - Verify all agents for Mysql have status Running @nightly @pmm-ps-integration',
  async ({ api }) => {
    const serviceList = await api.inventoryApi.getServicesByType(ServiceType.mysql);
    for (const service of serviceList) {
      await api.inventoryApi.verifyServiceAgentsStatus(service, AgentStatus.running);
    }
  },
);
