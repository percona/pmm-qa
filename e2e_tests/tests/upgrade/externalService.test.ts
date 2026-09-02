import pmmTest from '@fixtures/pmmTest';
import { services } from '../../testdata/externalServices';

pmmTest.describe('PMM upgrade tests for external services', () => {
  const redisServiceName = 'pmm-ui-tests-redis-external-remote';

  pmmTest('Adding Redis as external Service before Upgrade @pre-upgrade', async ({ api, cliHelper }) => {
    await api.remoteInstanceApi.addRemoteInstance({
      external: {
        add_node: { node_name: redisServiceName, node_type: 'NODE_TYPE_REMOTE_NODE' },
        address: 'external_pmm',
        cluster: 'redis_external_exporter',
        group: 'redis-remote',
        listen_port: '42200',
        metrics_path: '/metrics',
        schema: 'http',
        service_name: redisServiceName,
      },
    });

    cliHelper
      .execSilent(
        `docker exec external_pmm pmm-admin add external --listen-port=42200 --group="redis" --custom-labels="testing=redis" --service-name=${redisServiceName}-2`,
      )
      .assertSuccess();
  });

  for (const service of services) {
    // eslint-disable-next-line playwright/expect-expect -- Pre upgrade test
    pmmTest(
      `PMM-T2074 - Verify user can create Remote Instance ${service.serviceType} before upgrade @pre-upgrade`,
      async ({ api }) => {
        const remoteInstance = api.remoteInstanceApi.buildRemoteInstanceDataBody(service);

        await api.remoteInstanceApi.addRemoteInstance(remoteInstance);
      },
    );
  }
});
