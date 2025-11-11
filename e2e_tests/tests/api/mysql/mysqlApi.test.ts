import pmmTest from '../../../fixtures/pmmTest';
import { AgentStatus, ServiceType } from '../../../intefaces/inventory';

pmmTest.beforeEach(async ({ grafanaHelper }) => {
  await grafanaHelper.authorize();
});

pmmTest(
  'PMM-T2095 - Verify all agents for Mysql have status Running @nightly @pmm-ps-integration',
  async ({ inventoryApi }) => {
    const serviceList = await inventoryApi.getServicesByType(ServiceType.mysql);
    for (const service of serviceList) {
      await inventoryApi.verifyServiceAgentsStatus(service, AgentStatus.running);
    }
  },
);
