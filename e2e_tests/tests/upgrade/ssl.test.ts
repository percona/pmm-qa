import pmmTest from '@fixtures/pmmTest';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe('PMM upgrade tests for SSL', () => {
  const container = 'psmdb-server';
  const metric = 'mongodb_connections';
  const remoteServiceName = `remote_api_${container}`;

  pmmTest(
    'PMM-T948 + PMM-T947 - Verify Adding MongoDB SSL service remotely via API before upgrade @pre-upgrade',
    async ({ api, cliHelper }) => {
      const clientCert = cliHelper
        .execSilent(`docker exec ${container} cat /mongodb_certs/client.pem`)
        .assertSuccess().stdout;
      const caLocation = cliHelper.execSilent(`find / -name "ca.crt"`).stdout;

      console.log(`Ca Location is: ${caLocation}`);

      const ca = cliHelper.execSilent(`cat ${caLocation}`).assertSuccess().stdout;

      await api.remoteInstanceApi.addRemoteInstance({
        mongodb: {
          add_node: { node_name: remoteServiceName, node_type: 'NODE_TYPE_REMOTE_NODE' },
          address: container,
          authentication_mechanism: 'MONGODB-X509',
          cluster: 'mongodb_ssl_remote_cluster',
          pmm_agent_id: 'pmm-server',
          port: '27017',
          qan_mongodb_profiler: true,
          service_name: remoteServiceName,
          tls: true,
          tls_ca: ca,
          tls_certificate_file_password: '',
          tls_certificate_key: clientCert,
          tls_skip_verify: true,
        },
      });

      await expect
        .poll(() => api.inventoryApi.verifyAgentsAreRunning(remoteServiceName), {
          message: `One or more agents are not running for ${remoteServiceName}`,
          timeout: Timeouts.TWO_MINUTES,
        })
        .toBe(true);
    },
  );

  pmmTest('Verify metrics from SSL instances on PMM-Server @post-upgrade', async ({ api }) => {
    const clientService = await api.inventoryApi.getServiceDetailsByPartialName(container);

    await api.grafanaApi.waitForMetric(metric, clientService.service_name);
    await api.grafanaApi.waitForMetric(metric, remoteServiceName);
  });
});
