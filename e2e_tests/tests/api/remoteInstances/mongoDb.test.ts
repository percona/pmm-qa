import pmmTest from '@fixtures/pmmTest';
import { AddRemoteInstance } from '@api/remoteInstance.api';
import { Timeouts } from '@helpers/timeouts';
import { expect } from '@playwright/test';

pmmTest.describe('Api tests to verify remote mongodb', () => {
  const container = 'psmdb-server';
  const remoteServiceName = 'psmdb_ssl_remote_upgrade_service';

  pmmTest(
    'PMM-T948 Verify adding MongoDB SSL services remotely via API before upgrade @pre-upgrade',
    async ({ api, cliHelper }) => {
      const ca = cliHelper
        .execSilent(`docker exec ${container} cat /mongodb_certs/ca-certs.pem`)
        .assertSuccess().stdout;
      const clientCert = cliHelper
        .execSilent(`docker exec ${container} cat /mongodb_certs/client.pem`)
        .assertSuccess().stdout;

      const data: AddRemoteInstance = {
        mongodb: {
          add_node: { node_name: 'psmdb_ssl_remote_upgrade_node', node_type: 'NODE_TYPE_REMOTE_NODE' },
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
      };

      await api.remoteInstanceApi.addRemoteInstance(data);

      await expect
        .poll(() => api.inventoryApi.verifyAgentsAreRunning(remoteServiceName), {
          message: `One or more agents are not running for ${remoteServiceName}`,
          timeout: Timeouts.TWO_MINUTES,
        })
        .toBe(true);
    },
  );
});
