import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';

test.describe('External service pmm-admin update', { tag: '@external' }, () => {
  // containerName is discovered in beforeAll, so it is read when each test starts.
  let containerName: string;
  test.use({ pmmClientContainer: async ({}, use) => use(containerName) });

  const redisExporterPort = 42200;
  const serviceName = 'external_update_cli';
  const serverlessName = 'external_serverless_update_cli';
  let serviceAdded = false;
  let serverlessAdded = false;

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps --format \'{{.Names}}\' | grep \'^external_pmm\'');
    await result.outContains('external_pmm', 'External docker container should exist. please run pmm-framework with --database external');
    containerName = result.stdout.trim();
  });

  test.afterEach(async ({}) => {
    if (serviceAdded) {
      const output = await cli.exec(`docker exec ${containerName} pmm-admin remove external ${serviceName}`);
      await output.assertSuccess();
      serviceAdded = false;
    }

    if (serverlessAdded) {
      // The Service runs on a remote Node of its own, which stays after the Service is removed.
      await pmmApi.removeServerNode(serverlessName);
      serverlessAdded = false;
    }
  });

  test('PMM-T2654 - Verify pmm-admin update external changes the group in place', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add external --listen-port=${redisExporterPort} --group=redis --service-name=${serviceName}`);
    await output.assertSuccess();
    serviceAdded = true;
    const serviceId = await pmmAdmin.getServiceId(containerName, serviceName);
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);

    const result = await pmmAdmin.updateServiceOk(containerName, 'external', `--service-name=${serviceName} --group=external_update_group`);
    await result.outContains('External Service updated.');
    expect(pmmAdmin.getChangedSettings(result)).toEqual(['--group=external_update_group (was redis)']);

    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    const service = (await pmmAdmin.listServices(containerName)).find((item) => item.service_id === serviceId);
    expect(service?.external_group, 'Group is not changed in pmm-admin list').toEqual('external_update_group');
  });

  test('PMM-T2655 - Verify pmm-admin update external-serverless changes the metrics path in place', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add external-serverless --external-name=${serverlessName} --host=${containerName} --listen-port=${redisExporterPort} --metrics-path=/old-metrics --skip-connection-check`);
    await output.assertSuccess();
    serverlessAdded = true;
    // The Service sits on a Node of its own, which pmm-admin list of this client does not show.
    const serviceId = await pmmApi.getServerServiceId(serverlessName);
    const agents = await pmmApi.getServerServiceAgents(serviceId);
    expect(agents.length, 'external-exporter not found').toBeGreaterThan(0);

    const result = await pmmAdmin.updateServiceOk(containerName, 'external-serverless', `--external-name=${serverlessName} --metrics-path=/metrics`);
    await result.outContains('External Service updated.');
    expect(pmmAdmin.getChangedSettings(result)).toEqual(['--metrics-path=/metrics (was /old-metrics)']);

    expect(await pmmApi.getServerServiceId(serverlessName), 'Service ID changed').toEqual(serviceId);
    expect(await pmmApi.getServerServiceAgents(serviceId), 'Agent IDs changed').toEqual(agents);
  });

  test('PMM-T2656 - Verify pmm-admin update external-serverless requires the Service to be named', async ({}) => {
    const servicesBefore = await pmmAdmin.listServices(containerName);

    const output = await pmmAdmin.updateService(containerName, 'external-serverless', '--group=update_group');
    await cli.expectFailure(output, 'an external-serverless Service runs on a Node of its own; pass --external-name or --service-id');

    expect(await pmmAdmin.listServices(containerName), 'Services changed').toEqual(servicesBefore);
  });
});
