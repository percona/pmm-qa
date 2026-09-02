import pmmTest from '@fixtures/pmmTest';
import { AddRemoteInstance } from '@api/remoteInstance.api';

pmmTest.describe('Api tests to verify remote mongodb', () => {
  // eslint-disable-next-line playwright/expect-expect -- Pre upgrade test
  pmmTest(
    'PMM-T948 Verify adding MongoDB SSL services remotely via API before upgrade @pre-upgrade',
    async ({ api, cliHelper }) => {
      console.log(cliHelper.execSilent('docker exec psmdb-server cat /mongodb_certs/ca-certs.pem').stdout);

      const data: AddRemoteInstance = {
        mongodb: {
          add_node: {
            node_name: 'psmdb_ssl_remote_upgrade_node',
            node_type: 'NODE_TYPE_REMOTE_NODE',
          },
          address: 'psmdb-server',
          port: '27017',
          schema: 'https',
          service_name: 'psmdb_ssl_remote_upgrade_service',
          skip_connection_check: false,
          tls_ca: cliHelper.execSilent('docker exec psmdb-server cat /mongodb_certs/ca-certs.pem').stdout,
          tls_certificate_file_password: '',
          tls_certificate_key: cliHelper.execSilent('docker exec psmdb-server cat /client.pem').stdout,
        },
      };

      await api.remoteInstanceApi.addRemoteInstance(data);
    },
  );
});
