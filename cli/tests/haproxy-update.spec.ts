import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';

const exporterAgent = 'AGENT_TYPE_EXTERNAL_EXPORTER';

test.describe('HAProxy service pmm-admin update', { tag: '@haproxy' }, () => {
  // containerName is discovered in beforeAll, so it is read when each test starts.
  let containerName: string;
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  const serviceName = 'haproxy_update_cli';
  const listenPort = 42100;
  const newListenPort = 42101;
  const unusedListenPort = 42102;
  let serviceAdded = false;

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps | grep haproxy_pmm | awk \'{print $NF}\'');
    await result.outContains('haproxy_pmm', 'HAPROXY docker container should exist. please run pmm-framework with --database haproxy');
    containerName = result.stdout.trim();
  });

  test.afterEach(async ({}) => {
    if (serviceAdded) {
      const output = await cli.exec(`docker exec ${containerName} pmm-admin remove haproxy ${serviceName}`);
      await output.assertSuccess();
      serviceAdded = false;
    }
  });

  test('PMM-T2653 - Verify pmm-admin update haproxy changes the listen port in place', async ({}) => {
    // The HAProxy of the setup exposes its metrics on this port only.
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add haproxy --listen-port=${listenPort} ${serviceName}`);
    await output.assertSuccess();
    serviceAdded = true;
    const serviceId = await pmmAdmin.getServiceId(containerName, serviceName);
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);
    const exporterPort = async () => (await pmmAdmin.findServiceAgent(containerName, serviceId, exporterAgent))?.port;
    expect(await exporterPort()).toEqual(listenPort);

    const rejected = await pmmAdmin.updateService(containerName, 'haproxy', `${serviceName} --listen-port=${unusedListenPort}`);
    await cli.expectFailure(rejected, 'Connection check failed');
    expect(await exporterPort(), 'Listen port changed by a failed update').toEqual(listenPort);

    const moved = await pmmAdmin.updateServiceOk(containerName, 'haproxy', `${serviceName} --listen-port=${newListenPort} --skip-connection-check`);
    await moved.outContains('HAProxy Service updated.');
    expect(pmmAdmin.getChangedSettings(moved)).toEqual([`--listen-port=${newListenPort} (was ${listenPort})`]);
    expect(await exporterPort(), 'Listen port of the exporter is not changed').toEqual(newListenPort);
    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);

    const restored = await pmmAdmin.updateServiceOk(containerName, 'haproxy', `${serviceName} --listen-port=${listenPort}`);
    expect(pmmAdmin.getChangedSettings(restored)).toEqual([`--listen-port=${listenPort} (was ${newListenPort})`]);
    expect(await exporterPort(), 'Listen port of the exporter is not restored').toEqual(listenPort);
  });
});
