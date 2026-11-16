import { test, expect } from '@helpers/test';
import * as cli from '@helpers/cli-helper';
import * as pmmAdmin from '@helpers/pmm-admin';
import * as pmmCli from '@helpers/pmm-cli-helper';

const containerName = 'valkey-primary-1';
const port = '6379';
const username = 'default';
const password = 'VKvl41568AsE';

test.describe('Valkey pmm-admin update', { tag: '@valkey' }, () => {
  test.use({ pmmClientContainer: containerName });

  const serviceName = 'valkey_update_cli';
  let serviceAdded = false;

  test.beforeAll(async ({}) => {
    const result = await cli.exec(`docker ps | grep ${containerName} | awk '{print $NF}'`);
    await result.outContains(containerName, 'Valkey valkey-primary-1 docker container should exist. please run pmm-framework with --database valkey');
  });

  test.afterEach(async ({}) => {
    if (serviceAdded) {
      const output = await cli.exec(`docker exec ${containerName} pmm-admin remove valkey ${serviceName}`);
      await output.assertSuccess();
      serviceAdded = false;
    }
  });

  test('PMM-T2652 - Verify pmm-admin update valkey changes the log level in place', async ({}) => {
    const output = await cli.exec(`docker exec ${containerName} pmm-admin add valkey --username=${username} --password="${password}" --service-name=${serviceName} --host=${containerName} --port=${port}`);
    await output.assertSuccess();
    serviceAdded = true;
    const serviceId = await pmmAdmin.getServiceId(containerName, serviceName);
    const agentIds = await pmmAdmin.getServiceAgentIds(containerName, serviceId);
    const exporter = await pmmAdmin.findServiceAgent(containerName, serviceId, 'AGENT_TYPE_VALKEY_EXPORTER');
    expect(exporter, 'valkey_exporter not found').toBeTruthy();

    const result = await pmmAdmin.updateServiceOk(containerName, 'valkey', `${serviceName} --log-level=debug`);
    await result.outContains('Valkey Service updated.');
    expect(pmmAdmin.getChangedSettings(result)).toEqual([expect.stringMatching(/^--log-level=debug \(was .+\)$/)]);

    expect(await pmmAdmin.getServiceId(containerName, serviceName), 'Service ID changed').toEqual(serviceId);
    expect(await pmmAdmin.getServiceAgentIds(containerName, serviceId), 'Agent IDs changed').toEqual(agentIds);
    await expect(async () => {
      expect(await pmmCli.getExporterArgs(containerName, exporter!.agent_id)).toContain('--log-level=debug');
    }).toPass({ intervals: [3_000], timeout: 60_000 });
  });
});
