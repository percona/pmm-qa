import { expect, requirePmmClient, test } from '@helpers/test';
import { pmmAdminUpdateVersion } from '@helpers/versionGates';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmApi from '@helpers/pmm-api-helper';

const exporterAgent = 'AGENT_TYPE_EXTERNAL_EXPORTER';

test.describe('HAProxy service pmm-admin update', { tag: '@haproxy' }, () => {
  let containerName: string;

  const serviceName = 'haproxy_update_cli';
  const listenPort = 42100;
  const newListenPort = 42101;
  const unusedListenPort = 42102;
  let serviceAdded = false;

  const addService = async () => {
    // The HAProxy of the setup exposes its metrics on this port only.
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add haproxy --listen-port=${listenPort} ${serviceName}`);
    await output.assertSuccess();
    serviceAdded = true;

    return pmmAdmin.getServiceId(containerName, serviceName);
  };

  test.beforeAll(async ({}) => {
    const result = await cli.exec('docker ps | grep haproxy_pmm | awk \'{print $NF}\'');
    await result.outContains('haproxy_pmm', 'HAPROXY docker container should exist. please run pmm-framework with --database haproxy');
    containerName = result.stdout.trim();
    await requirePmmClient(containerName, pmmAdminUpdateVersion);
  });

  test.afterEach(async ({}) => {
    if (serviceAdded) {
      await pmmAdmin.removeService(containerName, 'haproxy', serviceName);
      serviceAdded = false;
    }
  });

  test('PMM-T2653 - Verify pmm-admin update haproxy changes the listen port in place', async ({}) => {
    const serviceId = await addService();
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

  test.describe('more update flags', () => {
    test('PMM-T2804 - Verify pmm-admin update haproxy changes the scheme and the metrics path and resets them to the defaults', async ({}) => {
      const serviceId = await addService();
      const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);

      // The exporter does not serve this scheme and path, so the connection check is skipped.
      const changed = await pmmAdmin.updateServiceJson(containerName, 'haproxy', `${serviceName} --scheme=https --metrics-path=custom-metrics --skip-connection-check`);
      expect(pmmAdmin.getSettingValue(changed, '--scheme')).toEqual('https');
      expect(pmmAdmin.getSettingValue(changed, '--metrics-path'), 'The leading slash is not added').toEqual('/custom-metrics');

      // An empty value goes back to the default, which the exporter serves, so the connection check passes.
      const reset = await pmmAdmin.updateServiceJson(containerName, 'haproxy', `${serviceName} --scheme= --metrics-path=`);
      expect(reset.changes.map((change) => change.flag).sort()).toEqual(['--metrics-path', '--scheme']);
      expect(pmmAdmin.getSettingValue(reset, '--scheme')).toEqual('http');
      expect(pmmAdmin.getSettingValue(reset, '--metrics-path')).toEqual('/metrics');
      expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    });

    test('PMM-T2805 - Verify pmm-admin update haproxy turns certificate verification off and on', async ({}) => {
      const serviceId = await addService();
      const exporterId = (await pmmAdmin.findServiceAgentId(containerName, serviceId, exporterAgent))!;

      const skipped = await pmmAdmin.updateServiceOk(containerName, 'haproxy', `${serviceName} --tls-skip-verify`);
      expect(pmmAdmin.getChangedSettings(skipped)).toEqual(['--tls-skip-verify (was --no-tls-skip-verify)']);
      expect((await pmmApi.getServerAgent(exporterId)).tls_skip_verify, 'Certificate verification is not skipped on PMM Server').toBe(true);

      const verified = await pmmAdmin.updateServiceOk(containerName, 'haproxy', `${serviceName} --no-tls-skip-verify`);
      expect(pmmAdmin.getChangedSettings(verified)).toEqual(['--no-tls-skip-verify (was --tls-skip-verify)']);
      expect((await pmmApi.getServerAgent(exporterId)).tls_skip_verify, 'Certificate verification is not enabled on PMM Server').toBe(false);
    });
  });
});
