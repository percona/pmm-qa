import pmmTest from '@fixtures/pmmTest';
import { AgentStatus, ServiceType } from '@interfaces/inventory';
import data from '@fixtures/dataTest';

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

// MySQL 8.4 renamed the SHOW SLAVE STATUS columns, so mysqld_exporter exports
// mysql_slave_status_replica_* there and mysql_slave_status_slave_* on 8.0 and below.
// The tag runs whichever PS version pmm-framework defaults to, so accept either name.
const replicaStatusAliases: Record<string, string> = {
  mysql_slave_status_slave_io_running: 'mysql_slave_status_replica_io_running',
  mysql_slave_status_slave_sql_running: 'mysql_slave_status_replica_sql_running',
};
const metrics: string[] = Object.keys(replicaStatusAliases);

data(metrics).pmmTest(
  'PMM-T2028 - Verify metrics from PS Replica instance on PMM-Server @pmm-ps-integration',
  async (data, { api }) => {
    await api.grafanaApi.waitForAnyMetric([data, replicaStatusAliases[data]]);
  },
);
