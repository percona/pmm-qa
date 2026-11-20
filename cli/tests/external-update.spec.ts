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

  const addService = async () => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add external --listen-port=${redisExporterPort} --group=redis --service-name=${serviceName}`);
    await output.assertSuccess();
    serviceAdded = true;

    return pmmAdmin.getServiceId(containerName, serviceName);
  };

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps --format \'{{.Names}}\' | grep \'^external_pmm\'');
    await result.outContains('external_pmm', 'External docker container should exist. please run pmm-framework with --database external');
    containerName = result.stdout.trim();
  });

  test.afterEach(async ({}) => {
    if (serviceAdded) {
      await pmmAdmin.removeService(containerName, 'external', serviceName);
      serviceAdded = false;
    }

    if (serverlessAdded) {
      // The Service runs on a remote Node of its own, which stays after the Service is removed.
      await pmmApi.removeServerNode(serverlessName);
      serverlessAdded = false;
    }
  });

  test('PMM-T2654 - Verify pmm-admin update external changes the group in place', async ({}) => {
    const serviceId = await addService();
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

  test.describe('more update flags', () => {
    const exporterAgent = 'AGENT_TYPE_EXTERNAL_EXPORTER';
    const newListenPort = 42201;

    test('PMM-T2800 - Verify pmm-admin update external changes the listen port only when the connection works or is not checked', async ({}) => {
      const serviceId = await addService();
      const exporterPort = async () => (await pmmAdmin.findServiceAgent(containerName, serviceId, exporterAgent))?.port;
      expect(await exporterPort()).toEqual(redisExporterPort);

      const rejected = await pmmAdmin.updateService(containerName, 'external', `--service-name=${serviceName} --listen-port=${newListenPort}`);
      await cli.expectFailure(rejected, 'Connection check failed');
      expect(await exporterPort(), 'Listen port changed by a failed update').toEqual(redisExporterPort);

      const moved = await pmmAdmin.updateServiceOk(containerName, 'external', `--service-name=${serviceName} --listen-port=${newListenPort} --skip-connection-check`);
      expect(pmmAdmin.getChangedSettings(moved)).toEqual([`--listen-port=${newListenPort} (was ${redisExporterPort})`]);
      expect(await exporterPort(), 'Listen port of the exporter is not changed').toEqual(newListenPort);

      const restored = await pmmAdmin.updateServiceOk(containerName, 'external', `--service-name=${serviceName} --listen-port=${redisExporterPort}`);
      expect(pmmAdmin.getChangedSettings(restored)).toEqual([`--listen-port=${redisExporterPort} (was ${newListenPort})`]);
      expect(await exporterPort(), 'Listen port of the exporter is not restored').toEqual(redisExporterPort);
    });

    test('PMM-T2801 - Verify pmm-admin update external changes the scheme and the metrics path and resets them to the defaults', async ({}) => {
      const serviceId = await addService();
      const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);

      // The exporter does not serve this scheme and path, so the connection check is skipped.
      const changed = await pmmAdmin.updateServiceJson(containerName, 'external', `--service-name=${serviceName} --scheme=https --metrics-path=custom-metrics --skip-connection-check`);
      expect(pmmAdmin.getSettingValue(changed, '--scheme')).toEqual('https');
      expect(pmmAdmin.getSettingValue(changed, '--metrics-path'), 'The leading slash is not added').toEqual('/custom-metrics');

      // An empty value goes back to the default, which the exporter serves, so the connection check passes.
      const reset = await pmmAdmin.updateServiceJson(containerName, 'external', `--service-name=${serviceName} --scheme= --metrics-path=`);
      expect(reset.changes.map((change) => change.flag).sort()).toEqual(['--metrics-path', '--scheme']);
      expect(pmmAdmin.getSettingValue(reset, '--scheme')).toEqual('http');
      expect(pmmAdmin.getSettingValue(reset, '--metrics-path')).toEqual('/metrics');
      expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    });

    test('PMM-T2802 - Verify pmm-admin update external turns certificate verification off and on', async ({}) => {
      const serviceId = await addService();
      const exporterId = (await pmmAdmin.findServiceAgentId(containerName, serviceId, exporterAgent))!;

      const skipped = await pmmAdmin.updateServiceOk(containerName, 'external', `--service-name=${serviceName} --tls-skip-verify`);
      expect(pmmAdmin.getChangedSettings(skipped)).toEqual(['--tls-skip-verify (was --no-tls-skip-verify)']);
      expect((await pmmApi.getServerAgent(exporterId)).tls_skip_verify, 'Certificate verification is not skipped on PMM Server').toBe(true);

      const verified = await pmmAdmin.updateServiceOk(containerName, 'external', `--service-name=${serviceName} --no-tls-skip-verify`);
      expect(pmmAdmin.getChangedSettings(verified)).toEqual(['--no-tls-skip-verify (was --tls-skip-verify)']);
      expect((await pmmApi.getServerAgent(exporterId)).tls_skip_verify, 'Certificate verification is not enabled on PMM Server').toBe(false);
    });
  });
});
